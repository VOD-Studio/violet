package customemoji

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domain "blog-api/internal/domain/customemoji"
	"blog-api/internal/domain/shared"
	"blog-api/internal/middleware"
)

// fakeRepo 内存态 domain.Repository 替身，参照 application/chat/reply_test.go 的手写 fake 风格。
type fakeRepo struct {
	byID      map[shared.ID]*domain.CustomEmoji
	favorites map[shared.ID]map[shared.ID]bool // userID -> emojiID -> true
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{byID: map[shared.ID]*domain.CustomEmoji{}, favorites: map[shared.ID]map[shared.ID]bool{}}
}

func (r *fakeRepo) Save(_ context.Context, e *domain.CustomEmoji) error {
	r.byID[e.ID()] = e
	return nil
}

func (r *fakeRepo) FindByID(_ context.Context, id shared.ID) (*domain.CustomEmoji, error) {
	e, ok := r.byID[id]
	if !ok {
		return nil, domain.ErrNotFound
	}
	return e, nil
}

func (r *fakeRepo) FindByIDs(_ context.Context, ids []shared.ID) ([]*domain.CustomEmoji, error) {
	out := make([]*domain.CustomEmoji, 0, len(ids))
	for _, id := range ids {
		if e, ok := r.byID[id]; ok && e.IsUsable() {
			out = append(out, e)
		}
	}
	return out, nil
}

func (r *fakeRepo) ExistsByOwnerAndName(_ context.Context, ownerID shared.ID, name string) (bool, error) {
	for _, e := range r.byID {
		if e.IsUsable() && e.OwnerID().Equal(ownerID) && e.Name() == name {
			return true, nil
		}
	}
	return false, nil
}

func (r *fakeRepo) CountOwned(_ context.Context, ownerID shared.ID) (int64, error) {
	var n int64
	for _, e := range r.byID {
		if e.IsUsable() && e.OwnerID().Equal(ownerID) {
			n++
		}
	}
	return n, nil
}

func (r *fakeRepo) ListOwned(_ context.Context, ownerID shared.ID) ([]*domain.CustomEmoji, error) {
	var out []*domain.CustomEmoji
	for _, e := range r.byID {
		if e.IsUsable() && e.OwnerID().Equal(ownerID) {
			out = append(out, e)
		}
	}
	return out, nil
}

func (r *fakeRepo) Delete(_ context.Context, e *domain.CustomEmoji) error {
	r.byID[e.ID()] = e
	return nil
}

func (r *fakeRepo) AddFavorite(_ context.Context, userID, emojiID shared.ID) error {
	if r.favorites[userID] == nil {
		r.favorites[userID] = map[shared.ID]bool{}
	}
	r.favorites[userID][emojiID] = true
	return nil
}

func (r *fakeRepo) RemoveFavorite(_ context.Context, userID, emojiID shared.ID) error {
	delete(r.favorites[userID], emojiID)
	return nil
}

func (r *fakeRepo) IsFavorited(_ context.Context, userID, emojiID shared.ID) (bool, error) {
	return r.favorites[userID][emojiID], nil
}

func (r *fakeRepo) CountFavorited(_ context.Context, userID shared.ID) (int64, error) {
	return int64(len(r.favorites[userID])), nil
}

func (r *fakeRepo) ListFavorited(_ context.Context, userID shared.ID) ([]*domain.CustomEmoji, error) {
	var out []*domain.CustomEmoji
	for id := range r.favorites[userID] {
		if e, ok := r.byID[id]; ok && e.IsUsable() {
			out = append(out, e)
		}
	}
	return out, nil
}

func (r *fakeRepo) FindFavoritedIDs(_ context.Context, userID shared.ID, emojiIDs []shared.ID) (map[shared.ID]bool, error) {
	out := make(map[shared.ID]bool, len(emojiIDs))
	for _, id := range emojiIDs {
		if r.favorites[userID][id] {
			out[id] = true
		}
	}
	return out, nil
}

// fakeQuota 固定上限的 QuotaPolicy 替身。
type fakeQuota struct{ max int }

func (f fakeQuota) MaxPerUser(context.Context) (int, error) { return f.max, nil }

// fakePermChecker 权限替身：codes 全在 allowed 集合才放行（同 application/tweet 的写法）。
type fakePermChecker struct{ allowed map[string]bool }

func (f fakePermChecker) HasPermission(_ string, _ bool, codes ...string) bool {
	for _, c := range codes {
		if !f.allowed[c] {
			return false
		}
	}
	return true
}

// ctxWithUser 注入 session 中间件同款身份上下文（同 application/tweet 的写法）。
func ctxWithUser(userID, role string, isBuiltin bool) context.Context {
	ctx := context.Background()
	ctx = context.WithValue(ctx, middleware.UserIDKey, userID)
	ctx = context.WithValue(ctx, middleware.UserRoleKey, role)
	ctx = context.WithValue(ctx, middleware.UserIsRootKey, isBuiltin)
	return ctx
}

func newTestService(repo domain.Repository, max int, perm PermissionChecker) *Service {
	return NewService(repo, fakeQuota{max: max}, perm, "")
}

func TestCreate_Success(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo, 100, nil)
	ownerID := shared.NewID()

	dto, err := svc.Create(context.Background(), CreateInput{OwnerID: ownerID, Name: "mycat", URL: "/uploads/emoji/a.png"})

	require.NoError(t, err)
	assert.Equal(t, "mycat", dto.Name)
	assert.NotEmpty(t, dto.ID)
}

func TestCreate_DuplicateNameSameOwner_Rejected(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo, 100, nil)
	ownerID := shared.NewID()

	_, err := svc.Create(context.Background(), CreateInput{OwnerID: ownerID, Name: "mycat", URL: "/a.png"})
	require.NoError(t, err)

	_, err = svc.Create(context.Background(), CreateInput{OwnerID: ownerID, Name: "mycat", URL: "/b.png"})
	require.ErrorIs(t, err, domain.ErrNameExists)
}

func TestCreate_SameNameDifferentOwner_Allowed(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo, 100, nil)

	_, err := svc.Create(context.Background(), CreateInput{OwnerID: shared.NewID(), Name: "mycat", URL: "/a.png"})
	require.NoError(t, err)

	_, err = svc.Create(context.Background(), CreateInput{OwnerID: shared.NewID(), Name: "mycat", URL: "/b.png"})
	require.NoError(t, err, "跨 owner 允许重名")
}

func TestCreate_QuotaExceeded_Rejected(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo, 1, nil)
	ownerID := shared.NewID()

	_, err := svc.Create(context.Background(), CreateInput{OwnerID: ownerID, Name: "one", URL: "/a.png"})
	require.NoError(t, err)

	_, err = svc.Create(context.Background(), CreateInput{OwnerID: ownerID, Name: "two", URL: "/b.png"})
	require.ErrorIs(t, err, domain.ErrQuotaExceeded)
}
func TestCreate_InvalidURL_Rejected(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo, fakeQuota{max: 100}, nil, "/uploads/")

	_, err := svc.Create(context.Background(), CreateInput{
		OwnerID: shared.NewID(),
		Name:    "mycat",
		URL:     "https://evil.example/cat.png",
	})

	require.ErrorIs(t, err, ErrInvalidURL)
}
func TestValidateContent_RequiresOwnedOrFavorited(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo, 100, nil)
	ownerID := shared.NewID()
	viewerID := shared.NewID()
	dto, err := svc.Create(context.Background(), CreateInput{OwnerID: ownerID, Name: "mycat", URL: "/a.png"})
	require.NoError(t, err)
	id := shared.MustParseID(dto.ID)

	err = svc.ValidateContent(context.Background(), "[mycat:"+id.String()+"]", viewerID)
	require.Error(t, err)

	require.NoError(t, svc.Favorite(context.Background(), viewerID, id))
	require.NoError(t, svc.ValidateContent(context.Background(), "[mycat:"+id.String()+"]", viewerID))
	require.NoError(t, svc.ValidateContent(context.Background(), "[doge]", viewerID))
}

func TestDelete_Owner_Succeeds(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo, 100, nil)
	ownerID := shared.NewID()

	dto, err := svc.Create(context.Background(), CreateInput{OwnerID: ownerID, Name: "mycat", URL: "/a.png"})
	require.NoError(t, err)
	id := shared.MustParseID(dto.ID)

	err = svc.Delete(ctxWithUser(ownerID.String(), "user", false), id)
	require.NoError(t, err)
	assert.False(t, repo.byID[id].IsUsable())
}

func TestDelete_NonOwnerWithoutPermission_Forbidden(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo, 100, fakePermChecker{allowed: map[string]bool{}})
	ownerID := shared.NewID()
	otherID := shared.NewID()

	dto, err := svc.Create(context.Background(), CreateInput{OwnerID: ownerID, Name: "mycat", URL: "/a.png"})
	require.NoError(t, err)
	id := shared.MustParseID(dto.ID)

	err = svc.Delete(ctxWithUser(otherID.String(), "user", false), id)
	require.Error(t, err)
	assert.True(t, repo.byID[id].IsUsable(), "无权限时不应删除")
}

func TestDelete_NonOwnerWithManagePermission_Succeeds(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo, 100, fakePermChecker{allowed: map[string]bool{ManagePermission: true}})
	ownerID := shared.NewID()
	adminID := shared.NewID()

	dto, err := svc.Create(context.Background(), CreateInput{OwnerID: ownerID, Name: "mycat", URL: "/a.png"})
	require.NoError(t, err)
	id := shared.MustParseID(dto.ID)

	err = svc.Delete(ctxWithUser(adminID.String(), "admin", false), id)
	require.NoError(t, err, "持 customemoji:manage 的管理员可强制下架任意用户的表情")
	assert.False(t, repo.byID[id].IsUsable())
}

func TestDelete_BuiltinSuperAdmin_Succeeds(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo, 100, nil)
	ownerID := shared.NewID()
	saID := shared.NewID()

	dto, err := svc.Create(context.Background(), CreateInput{OwnerID: ownerID, Name: "mycat", URL: "/a.png"})
	require.NoError(t, err)
	id := shared.MustParseID(dto.ID)

	err = svc.Delete(ctxWithUser(saID.String(), "superadmin", true), id)
	require.NoError(t, err, "内置超管通配放行")
}

func TestFavorite_Success_And_ResolveByIDs_ReturnsFavorited(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo, 100, nil)
	ownerID := shared.NewID()
	viewerID := shared.NewID()

	dto, err := svc.Create(context.Background(), CreateInput{OwnerID: ownerID, Name: "mycat", URL: "/a.png"})
	require.NoError(t, err)
	id := shared.MustParseID(dto.ID)

	require.NoError(t, svc.Favorite(context.Background(), viewerID, id))

	refs, err := svc.ResolveByIDs(context.Background(), []shared.ID{id}, viewerID)
	require.NoError(t, err)
	require.Contains(t, refs, id)
	assert.Equal(t, RelationFavorited, refs[id].Relation)
	assert.Equal(t, "/a.png", refs[id].URL)
}

func TestFavorite_OwnEmoji_Rejected(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo, 100, nil)
	ownerID := shared.NewID()

	dto, err := svc.Create(context.Background(), CreateInput{OwnerID: ownerID, Name: "mycat", URL: "/a.png"})
	require.NoError(t, err)
	id := shared.MustParseID(dto.ID)

	err = svc.Favorite(context.Background(), ownerID, id)
	require.ErrorIs(t, err, domain.ErrFavoriteOwnEmoji)
}

func TestFavorite_QuotaExceeded_CountsOwnedPlusFavorited(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo, 1, nil)
	ownerID := shared.NewID()
	viewerID := shared.NewID()

	dto, err := svc.Create(context.Background(), CreateInput{OwnerID: ownerID, Name: "mycat", URL: "/a.png"})
	require.NoError(t, err)
	id := shared.MustParseID(dto.ID)

	// viewer 已有 1 个自传的表情，份额上限 1，收藏第二个应超额拒绝。
	_, err = svc.Create(context.Background(), CreateInput{OwnerID: viewerID, Name: "own", URL: "/b.png"})
	require.NoError(t, err)

	err = svc.Favorite(context.Background(), viewerID, id)
	require.ErrorIs(t, err, domain.ErrQuotaExceeded)
}

func TestUnfavorite_Success(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo, 100, nil)
	ownerID := shared.NewID()
	viewerID := shared.NewID()

	dto, err := svc.Create(context.Background(), CreateInput{OwnerID: ownerID, Name: "mycat", URL: "/a.png"})
	require.NoError(t, err)
	id := shared.MustParseID(dto.ID)
	require.NoError(t, svc.Favorite(context.Background(), viewerID, id))

	require.NoError(t, svc.Unfavorite(context.Background(), viewerID, id))

	refs, err := svc.ResolveByIDs(context.Background(), []shared.ID{id}, viewerID)
	require.NoError(t, err)
	assert.Equal(t, RelationNone, refs[id].Relation, "移出后回落到 none")
}

func TestResolveByIDs_Owned(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo, 100, nil)
	ownerID := shared.NewID()

	dto, err := svc.Create(context.Background(), CreateInput{OwnerID: ownerID, Name: "mycat", URL: "/a.png"})
	require.NoError(t, err)
	id := shared.MustParseID(dto.ID)

	refs, err := svc.ResolveByIDs(context.Background(), []shared.ID{id}, ownerID)
	require.NoError(t, err)
	assert.Equal(t, RelationOwned, refs[id].Relation)
}

func TestResolveByIDs_None(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo, 100, nil)
	ownerID := shared.NewID()
	viewerID := shared.NewID()

	dto, err := svc.Create(context.Background(), CreateInput{OwnerID: ownerID, Name: "mycat", URL: "/a.png"})
	require.NoError(t, err)
	id := shared.MustParseID(dto.ID)

	refs, err := svc.ResolveByIDs(context.Background(), []shared.ID{id}, viewerID)
	require.NoError(t, err)
	assert.Equal(t, RelationNone, refs[id].Relation)
}

func TestResolveByIDs_ZeroViewer_AnonymousSafe(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo, 100, nil)
	ownerID := shared.NewID()

	dto, err := svc.Create(context.Background(), CreateInput{OwnerID: ownerID, Name: "mycat", URL: "/a.png"})
	require.NoError(t, err)
	id := shared.MustParseID(dto.ID)

	refs, err := svc.ResolveByIDs(context.Background(), []shared.ID{id}, shared.ID{})
	require.NoError(t, err)
	assert.Equal(t, RelationNone, refs[id].Relation)
}

func TestResolveByIDs_DeletedID_NotInResult(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo, 100, nil)
	ownerID := shared.NewID()

	dto, err := svc.Create(context.Background(), CreateInput{OwnerID: ownerID, Name: "mycat", URL: "/a.png"})
	require.NoError(t, err)
	id := shared.MustParseID(dto.ID)
	require.NoError(t, svc.Delete(ctxWithUser(ownerID.String(), "user", false), id))

	refs, err := svc.ResolveByIDs(context.Background(), []shared.ID{id}, ownerID)
	require.NoError(t, err)
	assert.NotContains(t, refs, id, "下架后 ResolveByIDs 对该 ID 返回未命中")
}

func TestResolveByIDs_UnknownID_NotInResult(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo, 100, nil)

	refs, err := svc.ResolveByIDs(context.Background(), []shared.ID{shared.NewID()}, shared.NewID())
	require.NoError(t, err)
	assert.Empty(t, refs)
}

func TestListMine_ReturnsOwnedAndFavorited(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo, 100, nil)
	ownerID := shared.NewID()
	viewerID := shared.NewID()

	owned, err := svc.Create(context.Background(), CreateInput{OwnerID: viewerID, Name: "own", URL: "/a.png"})
	require.NoError(t, err)
	favorited, err := svc.Create(context.Background(), CreateInput{OwnerID: ownerID, Name: "fav", URL: "/b.png"})
	require.NoError(t, err)
	require.NoError(t, svc.Favorite(context.Background(), viewerID, shared.MustParseID(favorited.ID)))

	mine, err := svc.ListMine(context.Background(), viewerID)
	require.NoError(t, err)
	require.Len(t, mine.Owned, 1)
	assert.Equal(t, owned.ID, mine.Owned[0].ID)
	require.Len(t, mine.Favorited, 1)
	assert.Equal(t, favorited.ID, mine.Favorited[0].ID)
}

// TestAdminTakedown_CascadesToOwnerAndFavoriterViews 覆盖 issue-257 级联验收：
// 管理员强制下架后，原上传者与收藏者的「我的表情」都不再展示该表情，
// ResolveByIDs 对该 ID 返回未命中（历史内容渲染降级为占位文本，前端零改动生效）。
func TestAdminTakedown_CascadesToOwnerAndFavoriterViews(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo, 100, fakePermChecker{allowed: map[string]bool{ManagePermission: true}})
	ownerID := shared.NewID()
	favoriterID := shared.NewID()
	adminID := shared.NewID()

	created, err := svc.Create(context.Background(), CreateInput{OwnerID: ownerID, Name: "mycat", URL: "/a.png"})
	require.NoError(t, err)
	id := shared.MustParseID(created.ID)
	require.NoError(t, svc.Favorite(context.Background(), favoriterID, id))

	err = svc.Delete(ctxWithUser(adminID.String(), "admin", false), id)
	require.NoError(t, err, "管理员持 customemoji:manage 可强制下架任意用户的表情")

	ownerMine, err := svc.ListMine(context.Background(), ownerID)
	require.NoError(t, err)
	assert.Empty(t, ownerMine.Owned, "下架后原上传者的我的表情不再展示该表情")

	favoriterMine, err := svc.ListMine(context.Background(), favoriterID)
	require.NoError(t, err)
	assert.Empty(t, favoriterMine.Favorited, "下架后收藏者的我的表情不再展示该表情")

	refs, err := svc.ResolveByIDs(context.Background(), []shared.ID{id}, favoriterID)
	require.NoError(t, err)
	assert.NotContains(t, refs, id, "历史内容中的引用应渲染降级为占位文本（未命中）")
}
