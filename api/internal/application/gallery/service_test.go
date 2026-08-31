package gallery

import (
	"context"
	"sort"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appshared "blog-api/internal/application/shared"
	domaingallery "blog-api/internal/domain/gallery"
	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/upload"
)

type fakeGalleryRepo struct {
	gallery       *domaingallery.Gallery
	saved         bool
	published     bool
	publishedRows []domaingallery.PublishedGallery
	publishedOne  domaingallery.PublishedGallery
	lastCursor    *domaingallery.PublishedCursor
	lastLimit     int
}

func (r *fakeGalleryRepo) Create(_ context.Context, gallery *domaingallery.Gallery) error {
	r.gallery = gallery
	return nil
}
func (r *fakeGalleryRepo) FindByID(_ context.Context, _ shared.ID) (*domaingallery.Gallery, error) {
	if r.gallery == nil {
		return nil, domaingallery.ErrNotFound
	}
	return r.gallery, nil
}
func (r *fakeGalleryRepo) FindByIDForUpdate(ctx context.Context, id shared.ID) (*domaingallery.Gallery, error) {
	return r.FindByID(ctx, id)
}
func (r *fakeGalleryRepo) FindPageByAuthor(_ context.Context, _ shared.ID, q shared.PageQuery) (shared.PageResult[*domaingallery.Gallery], error) {
	items := make([]*domaingallery.Gallery, 0)
	if r.gallery != nil {
		items = append(items, r.gallery)
	}
	return shared.NewPageResult(q, items, int64(len(items))), nil
}
func (r *fakeGalleryRepo) SaveWorking(_ context.Context, _ *domaingallery.Gallery, _ int64) error {
	r.saved = true
	return nil
}
func (r *fakeGalleryRepo) SavePublished(_ context.Context, _ *domaingallery.Gallery, _ int64) error {
	r.published = true
	return nil
}
func (r *fakeGalleryRepo) FindPublishedPage(_ context.Context, cursor *domaingallery.PublishedCursor, limit int) ([]domaingallery.PublishedGallery, error) {
	r.lastCursor, r.lastLimit = cursor, limit
	rows := r.publishedRows
	if len(rows) > limit {
		rows = rows[:limit]
	}
	return rows, nil
}
func (r *fakeGalleryRepo) FindPublishedBySlug(_ context.Context, slug string) (domaingallery.PublishedGallery, error) {
	if r.publishedOne.Slug != slug {
		return domaingallery.PublishedGallery{}, domaingallery.ErrNotFound
	}
	return r.publishedOne, nil
}

type fakeAssetStore struct {
	assets     map[shared.ID]Asset
	deltas     map[shared.ID]int
	findCalls  int
	lockedRead bool
	lockedIDs  []shared.ID
}

func (s *fakeAssetStore) FindByIDs(_ context.Context, ids []shared.ID) ([]Asset, error) {
	s.findCalls++
	return s.find(ids), nil
}
func (s *fakeAssetStore) FindByIDsForUpdate(_ context.Context, ids []shared.ID) ([]Asset, error) {
	s.lockedRead = true
	s.lockedIDs = append([]shared.ID(nil), ids...)
	return s.find(ids), nil
}
func (s *fakeAssetStore) find(ids []shared.ID) []Asset {
	result := make([]Asset, 0, len(ids))
	for _, id := range ids {
		if asset, ok := s.assets[id]; ok {
			result = append(result, asset)
		}
	}
	return result
}
func (s *fakeAssetStore) UpdateRefCount(_ context.Context, id shared.ID, delta int) error {
	if s.deltas == nil {
		s.deltas = make(map[shared.ID]int)
	}
	s.deltas[id] += delta
	return nil
}

type fakeTransaction struct {
	repo   domaingallery.Repository
	assets AssetStore
}

func (t fakeTransaction) Galleries() domaingallery.Repository { return t.repo }
func (t fakeTransaction) Assets() AssetStore                  { return t.assets }

type fakeUnitOfWork struct{ tx Transaction }

func (u fakeUnitOfWork) Do(_ context.Context, fn func(Transaction) error) error { return fn(u.tx) }

func newServiceFixture(t *testing.T, owner shared.ID, initial []shared.ID) (*Service, *fakeGalleryRepo, *fakeAssetStore, *domaingallery.Gallery) {
	t.Helper()
	gallery, err := domaingallery.NewGallery(shared.NewID(), owner, shared.NewID())
	require.NoError(t, err)
	if len(initial) > 0 {
		document := make([]domaingallery.DocumentItem, 0, len(initial))
		for _, id := range initial {
			document = append(document, domaingallery.DocumentItem{FileID: id})
		}
		require.NoError(t, gallery.ReplaceWorkingDocument(1, "旧标题", "", document))
	}
	repo := &fakeGalleryRepo{gallery: gallery}
	assets := &fakeAssetStore{assets: make(map[shared.ID]Asset), deltas: make(map[shared.ID]int)}
	for _, id := range initial {
		assets.assets[id] = readyImage(id, owner)
	}
	uow := fakeUnitOfWork{tx: fakeTransaction{repo: repo, assets: assets}}
	return NewService(repo, assets, uow, appshared.NoopEventBus{}), repo, assets, gallery
}

func readyImage(id, owner shared.ID) Asset {
	return Asset{ID: id, OwnerID: owner, URL: "/image", MimeType: "image/jpeg", Status: upload.StatusReady}
}

func TestSaveRejectsStaleVersionBeforeTouchingAssets(t *testing.T) {
	owner := shared.NewID()
	service, repo, assets, gallery := newServiceFixture(t, owner, nil)
	_, err := service.Save(context.Background(), SaveInput{
		UserID: owner.String(), GalleryID: gallery.ID().String(), ExpectedVersion: 2,
		Title: "标题", Summary: "", Items: []SaveItemInput{},
	})
	require.Error(t, err)
	assert.True(t, shared.IsDomainError(err, shared.CodeConflict))
	assert.False(t, assets.lockedRead)
	assert.False(t, repo.saved)
}

func TestSaveRejectsNonOwner(t *testing.T) {
	owner := shared.NewID()
	service, repo, assets, gallery := newServiceFixture(t, owner, nil)
	_, err := service.Save(context.Background(), SaveInput{
		UserID: shared.NewID().String(), GalleryID: gallery.ID().String(), ExpectedVersion: 1,
		Title: "", Summary: "", Items: []SaveItemInput{},
	})
	require.Error(t, err)
	assert.True(t, shared.IsDomainError(err, shared.CodeForbidden))
	assert.False(t, assets.lockedRead)
	assert.False(t, repo.saved)
}

func TestSaveRejectsDuplicateBeforeTouchingAssets(t *testing.T) {
	owner, fileID := shared.NewID(), shared.NewID()
	service, repo, assets, gallery := newServiceFixture(t, owner, nil)
	_, err := service.Save(context.Background(), SaveInput{
		UserID: owner.String(), GalleryID: gallery.ID().String(), ExpectedVersion: 1,
		Title: "", Summary: "", Items: []SaveItemInput{{FileID: fileID.String()}, {FileID: fileID.String()}},
	})
	require.Error(t, err)
	assert.True(t, shared.IsDomainError(err, shared.CodeBadRequest))
	assert.False(t, assets.lockedRead)
	assert.False(t, repo.saved)
}

func TestSaveRejectsUnavailableOrNonImageAssets(t *testing.T) {
	tests := []struct {
		name  string
		asset func(id, owner shared.ID) Asset
	}{
		{name: "not ready", asset: func(id, owner shared.ID) Asset {
			return Asset{ID: id, OwnerID: owner, MimeType: "image/jpeg", Status: upload.StatusProcessing}
		}},
		{name: "not image", asset: func(id, owner shared.ID) Asset {
			return Asset{ID: id, OwnerID: owner, MimeType: "video/mp4", Status: upload.StatusReady}
		}},
		{name: "foreign owner", asset: func(id, _ shared.ID) Asset {
			return Asset{ID: id, OwnerID: shared.NewID(), MimeType: "image/jpeg", Status: upload.StatusReady}
		}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			owner, fileID := shared.NewID(), shared.NewID()
			service, repo, assets, gallery := newServiceFixture(t, owner, nil)
			assets.assets[fileID] = tt.asset(fileID, owner)
			_, err := service.Save(context.Background(), SaveInput{
				UserID: owner.String(), GalleryID: gallery.ID().String(), ExpectedVersion: 1,
				Title: "", Summary: "", Items: []SaveItemInput{{FileID: fileID.String()}},
			})
			require.Error(t, err)
			assert.True(t, shared.IsDomainError(err, shared.CodeBadRequest))
			assert.False(t, repo.saved)
		})
	}
}

func TestSaveUpdatesOnlyReferenceSetDifference(t *testing.T) {
	owner := shared.NewID()
	oldA, retainedB, addedC := shared.NewID(), shared.NewID(), shared.NewID()
	service, repo, assets, gallery := newServiceFixture(t, owner, []shared.ID{oldA, retainedB})
	assets.assets[retainedB] = readyImage(retainedB, owner)
	assets.assets[addedC] = readyImage(addedC, owner)

	dto, err := service.Save(context.Background(), SaveInput{
		UserID: owner.String(), GalleryID: gallery.ID().String(), ExpectedVersion: 2,
		Title: "新标题", Summary: "摘要",
		Items: []SaveItemInput{{FileID: retainedB.String()}, {FileID: addedC.String()}},
	})
	require.NoError(t, err)
	assert.True(t, repo.saved)
	assert.Equal(t, 1, assets.deltas[addedC])
	assert.Equal(t, -1, assets.deltas[oldA])
	assert.Zero(t, assets.deltas[retainedB])
	assert.ElementsMatch(t, []shared.ID{oldA, retainedB, addedC}, assets.lockedIDs)
	assert.True(t, sort.SliceIsSorted(assets.lockedIDs, func(i, j int) bool {
		return assets.lockedIDs[i].String() < assets.lockedIDs[j].String()
	}))
	assert.Equal(t, int64(3), dto.Version)
	assert.Len(t, dto.Items, 2)
}

func TestSaveCanRemoveAllExistingAssets(t *testing.T) {
	owner := shared.NewID()
	oldA, oldB := shared.NewID(), shared.NewID()
	service, repo, assets, gallery := newServiceFixture(t, owner, []shared.ID{oldA, oldB})

	dto, err := service.Save(context.Background(), SaveInput{
		UserID: owner.String(), GalleryID: gallery.ID().String(), ExpectedVersion: 2,
		Title: "清空工作稿", Items: []SaveItemInput{},
	})

	require.NoError(t, err)
	assert.True(t, repo.saved)
	assert.Equal(t, -1, assets.deltas[oldA])
	assert.Equal(t, -1, assets.deltas[oldB])
	assert.ElementsMatch(t, []shared.ID{oldA, oldB}, assets.lockedIDs)
	assert.Empty(t, dto.Items)
}

func TestPublishValidatesAssetsAndAdvancesVersion(t *testing.T) {
	owner, first, second := shared.NewID(), shared.NewID(), shared.NewID()
	service, repo, assets, gallery := newServiceFixture(t, owner, []shared.ID{first, second})
	assets.assets[first] = readyImage(first, owner)
	assets.assets[second] = readyImage(second, owner)

	dto, err := service.Publish(context.Background(), PublishInput{
		UserID: owner.String(), GalleryID: gallery.ID().String(), ExpectedVersion: 2,
	})

	require.NoError(t, err)
	assert.True(t, repo.published)
	assert.Equal(t, int64(3), dto.Version)
	assert.Equal(t, domaingallery.StatusPublished, dto.Status)
	require.NotNil(t, dto.Slug)
	assert.Contains(t, *dto.Slug, gallery.ID().String()[:8])
	require.NotNil(t, dto.PublishedAt)
	assert.ElementsMatch(t, []shared.ID{first, second}, assets.lockedIDs)
}

func TestPublishRejectsUnavailableAssetWithoutPersisting(t *testing.T) {
	owner, first, second := shared.NewID(), shared.NewID(), shared.NewID()
	service, repo, assets, gallery := newServiceFixture(t, owner, []shared.ID{first, second})
	assets.assets[first] = readyImage(first, owner)
	assets.assets[second] = Asset{ID: second, OwnerID: owner, MimeType: "image/jpeg", Status: upload.StatusProcessing}

	_, err := service.Publish(context.Background(), PublishInput{
		UserID: owner.String(), GalleryID: gallery.ID().String(), ExpectedVersion: 2,
	})

	require.Error(t, err)
	assert.True(t, shared.IsDomainError(err, shared.CodeBadRequest))
	assert.False(t, repo.published)
}

func TestPublishRejectsNonOwnerAndStaleVersionBeforeAssetLocks(t *testing.T) {
	owner, first, second := shared.NewID(), shared.NewID(), shared.NewID()
	for _, tt := range []struct {
		name            string
		userID          shared.ID
		expectedVersion int64
		code            shared.ErrorCode
	}{
		{name: "not owner", userID: shared.NewID(), expectedVersion: 2, code: shared.CodeForbidden},
		{name: "stale version", userID: owner, expectedVersion: 1, code: shared.CodeConflict},
	} {
		t.Run(tt.name, func(t *testing.T) {
			service, repo, assets, gallery := newServiceFixture(t, owner, []shared.ID{first, second})
			_, err := service.Publish(context.Background(), PublishInput{
				UserID: tt.userID.String(), GalleryID: gallery.ID().String(), ExpectedVersion: tt.expectedVersion,
			})
			require.Error(t, err)
			assert.True(t, shared.IsDomainError(err, tt.code))
			assert.False(t, assets.lockedRead)
			assert.False(t, repo.published)
		})
	}
}

func TestSavePublishedGalleryUsesCopyOnWriteAndCountsNewRevisionReferences(t *testing.T) {
	owner, first, removed, added := shared.NewID(), shared.NewID(), shared.NewID(), shared.NewID()
	service, _, assets, gallery := newServiceFixture(t, owner, []shared.ID{first, removed})
	require.NoError(t, gallery.Publish(2, "stable-slug", time.Now()))
	publishedRevisionID := *gallery.PublishedRevisionID()
	assets.assets[first] = readyImage(first, owner)
	assets.assets[added] = readyImage(added, owner)

	dto, err := service.Save(context.Background(), SaveInput{
		UserID: owner.String(), GalleryID: gallery.ID().String(), ExpectedVersion: 3,
		Title: "维护中的标题", Items: []SaveItemInput{{FileID: first.String()}, {FileID: added.String()}},
	})

	require.NoError(t, err)
	assert.Equal(t, int64(4), dto.Version)
	require.NotNil(t, dto.Slug)
	assert.Equal(t, "stable-slug", *dto.Slug)
	assert.False(t, gallery.WorkingRevision().ID().Equal(publishedRevisionID))
	assert.True(t, gallery.PublishedRevisionID().Equal(publishedRevisionID))
	assert.Equal(t, 1, assets.deltas[first])
	assert.Equal(t, 1, assets.deltas[added])
	assert.Zero(t, assets.deltas[removed])
}

func TestBrowsePublishedReturnsCompleteItemsAndStableCursor(t *testing.T) {
	owner := shared.NewID()
	service, repo, assets, _ := newServiceFixture(t, owner, nil)
	publishedAt := time.Date(2026, time.August, 31, 10, 0, 0, 0, time.UTC)
	rows := make([]domaingallery.PublishedGallery, 0, 3)
	for i := 0; i < 3; i++ {
		gallery, err := domaingallery.NewGallery(shared.NewID(), owner, shared.NewID())
		require.NoError(t, err)
		first, second := shared.NewID(), shared.NewID()
		require.NoError(t, gallery.ReplaceWorkingDocument(1, "公开作品", "摘要", []domaingallery.DocumentItem{{FileID: first}, {FileID: second, AltTextOverride: "覆盖文本"}}))
		assets.assets[first] = Asset{ID: first, OwnerID: owner, URL: "/original-a", Thumbnail: "/thumb-a", AltText: "素材文本"}
		assets.assets[second] = Asset{ID: second, OwnerID: owner, URL: "/original-b", Thumbnail: "/thumb-b"}
		rows = append(rows, domaingallery.PublishedGallery{ID: gallery.ID(), Slug: "gallery-" + string(rune('a'+i)), PublishedAt: publishedAt.Add(-time.Duration(i) * time.Minute), Revision: gallery.WorkingRevision()})
	}
	repo.publishedRows = rows

	dtos, next, err := service.BrowsePublished(context.Background(), "", 2)
	require.NoError(t, err)
	assert.Len(t, dtos, 2)
	assert.Len(t, dtos[0].Items, 2)
	assert.Equal(t, "素材文本", dtos[0].Items[0].AltText)
	assert.Equal(t, "覆盖文本", dtos[0].Items[1].AltText)
	assert.NotEmpty(t, next)
	assert.Equal(t, 3, repo.lastLimit)
	assert.Equal(t, 1, assets.findCalls)
	cursor, err := decodePublishedCursor(next)
	require.NoError(t, err)
	assert.True(t, cursor.ID.Equal(rows[1].ID))
	assert.Equal(t, rows[1].PublishedAt, cursor.PublishedAt)
}

func TestGetPublishedFallsBackToTitleAndPositionForAltText(t *testing.T) {
	owner, first, second := shared.NewID(), shared.NewID(), shared.NewID()
	service, repo, assets, gallery := newServiceFixture(t, owner, nil)
	require.NoError(t, gallery.ReplaceWorkingDocument(1, "远山", "", []domaingallery.DocumentItem{{FileID: first}, {FileID: second}}))
	repo.publishedOne = domaingallery.PublishedGallery{ID: gallery.ID(), Slug: "far-mountain", PublishedAt: time.Now(), Revision: gallery.WorkingRevision()}
	assets.assets[first] = Asset{ID: first, URL: "/a", Thumbnail: "/ta"}
	assets.assets[second] = Asset{ID: second, URL: "/b", Thumbnail: "/tb"}

	dto, err := service.GetPublished(context.Background(), "far-mountain")
	require.NoError(t, err)
	assert.Equal(t, "远山 第 1 张", dto.Items[0].AltText)
	assert.Equal(t, "远山 第 2 张", dto.Items[1].AltText)
}
