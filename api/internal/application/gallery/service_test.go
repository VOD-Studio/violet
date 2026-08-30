package gallery

import (
	"context"
	"sort"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appshared "blog-api/internal/application/shared"
	domaingallery "blog-api/internal/domain/gallery"
	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/upload"
)

type fakeGalleryRepo struct {
	gallery *domaingallery.Gallery
	saved   bool
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

type fakeAssetStore struct {
	assets     map[shared.ID]Asset
	deltas     map[shared.ID]int
	lockedRead bool
	lockedIDs  []shared.ID
}

func (s *fakeAssetStore) FindByIDs(_ context.Context, ids []shared.ID) ([]Asset, error) {
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
