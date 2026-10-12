package post

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domain "blog-api/internal/domain/post"
	"blog-api/internal/domain/shared"
	userdomain "blog-api/internal/domain/user"
)

// fakePublishedSlugRepo 覆盖 FindBySlug / FindActiveByID，按预设返回文章（或 ErrNotFound）。
// 其余方法继承 fakeSlugRepo（panic），保证测试范围不越界。
type fakePublishedSlugRepo struct {
	fakeSlugRepo
	bySlug map[string]*domain.Post
	byID   map[string]*domain.Post // FindActiveByID；不含软删除行
}

func (f *fakePublishedSlugRepo) FindBySlug(_ context.Context, slug string) (*domain.Post, error) {
	p, ok := f.bySlug[slug]
	if !ok {
		return nil, domain.ErrNotFound
	}
	return p, nil
}

func (f *fakePublishedSlugRepo) FindActiveByID(_ context.Context, id shared.ID) (*domain.Post, error) {
	p, ok := f.byID[id.String()]
	if !ok {
		return nil, domain.ErrNotFound
	}
	return p, nil
}

func (f *fakePublishedSlugRepo) FindCollaboratorIDsByPostID(context.Context, shared.ID) ([]shared.ID, error) {
	return nil, nil
}

type authorLookupStub struct {
	userdomain.UserRepository
	users []*userdomain.User
}

func (s *authorLookupStub) FindByIDsForDisplay(context.Context, []shared.ID) ([]*userdomain.User, error) {
	return s.users, nil
}

func (s *authorLookupStub) FindByIDs(context.Context, []shared.ID) ([]*userdomain.User, error) {
	return s.users, nil
}

func newPublishedSlugTestService(posts ...*domain.Post) *Service {
	bySlug := make(map[string]*domain.Post, len(posts))
	byID := make(map[string]*domain.Post, len(posts))
	for _, p := range posts {
		bySlug[p.Slug()] = p
		byID[p.ID().String()] = p
	}
	return &Service{repo: &fakePublishedSlugRepo{bySlug: bySlug, byID: byID}}
}

func TestService_GetPublishedBySlug_Published(t *testing.T) {
	p := mustReconstructPost(t, "quantum-intro", "量子计算入门", "正文", "摘要")
	svc := newPublishedSlugTestService(p)

	dto, err := svc.GetPublishedBySlug(context.Background(), "quantum-intro")
	require.NoError(t, err)
	assert.Equal(t, "quantum-intro", dto.Slug)
	assert.Equal(t, domain.StatusPublished, dto.Status)
	assert.Equal(t, "量子计算入门", dto.Title)
}

func TestService_GetPublishedBySlug_PopulatesAuthor(t *testing.T) {
	p := mustReconstructPost(t, "with-author", "有作者", "正文", "摘要")
	email, err := userdomain.ParseEmail("writer@example.com")
	require.NoError(t, err)
	username, err := userdomain.ParseUsername("writer")
	require.NoError(t, err)
	author := userdomain.NewUser(p.AuthorID(), email, username, userdomain.NewPasswordHash("hash"))
	svc := newPublishedSlugTestService(p)
	svc.userRepo = &authorLookupStub{users: []*userdomain.User{author}}

	dto, err := svc.GetPublishedBySlug(context.Background(), p.Slug())
	require.NoError(t, err)
	require.NotNil(t, dto.Author)
	assert.Equal(t, "writer", dto.Author.Username)
}

func TestService_GetPublishedBySlug_DraftReturnsNotFound(t *testing.T) {
	p := reconstructPostWithStatus(t, "wip", "草稿", domain.StatusDraft)
	svc := newPublishedSlugTestService(p)

	_, err := svc.GetPublishedBySlug(context.Background(), "wip")
	assert.ErrorIs(t, err, domain.ErrNotFound)
}

func TestService_GetPublishedBySlug_ArchivedReturnsNotFound(t *testing.T) {
	p := reconstructPostWithStatus(t, "old", "归档", domain.StatusArchived)
	svc := newPublishedSlugTestService(p)

	_, err := svc.GetPublishedBySlug(context.Background(), "old")
	assert.ErrorIs(t, err, domain.ErrNotFound)
}

func TestService_GetPublishedBySlug_NotExistReturnsNotFound(t *testing.T) {
	svc := newPublishedSlugTestService()

	_, err := svc.GetPublishedBySlug(context.Background(), "no-such-slug")
	assert.ErrorIs(t, err, domain.ErrNotFound)
}

// TestService_GetPublishedBySlug_NotFoundIndistinguishable 验证 draft / archived /
// 不存在 三种情形均返回同一个 ErrNotFound，调用方无法据此区分文章存在与否
// （防状态枚举攻击）。
func TestService_GetPublishedBySlug_NotFoundIndistinguishable(t *testing.T) {
	draft := reconstructPostWithStatus(t, "d", "草稿", domain.StatusDraft)
	archived := reconstructPostWithStatus(t, "a", "归档", domain.StatusArchived)
	svc := newPublishedSlugTestService(draft, archived)

	errDraft := getErr(svc, "d")
	errArchived := getErr(svc, "a")
	errMissing := getErr(svc, "missing")

	for _, e := range []error{errDraft, errArchived, errMissing} {
		require.Error(t, e, "三种情形都应报错")
		assert.ErrorIs(t, e, domain.ErrNotFound, "都应返回 ErrNotFound")
	}
	// 错误文本一致才算真正不可区分
	assert.Equal(t, errDraft.Error(), errArchived.Error())
	assert.Equal(t, errDraft.Error(), errMissing.Error())
}

func getErr(svc *Service, slug string) error {
	_, err := svc.GetPublishedBySlug(context.Background(), slug)
	return err
}

func TestService_GetPublishedByID_Published(t *testing.T) {
	p := mustReconstructPost(t, "by-id", "按 ID", "正文", "摘要")
	svc := newPublishedSlugTestService(p)

	dto, err := svc.GetPublishedByID(context.Background(), p.ID().String())
	require.NoError(t, err)
	assert.Equal(t, p.ID().String(), dto.ID)
	assert.Equal(t, domain.StatusPublished, dto.Status)
}

func TestService_GetPublishedByID_DraftReturnsNotFound(t *testing.T) {
	p := reconstructPostWithStatus(t, "draft-id", "草稿", domain.StatusDraft)
	svc := newPublishedSlugTestService(p)

	_, err := svc.GetPublishedByID(context.Background(), p.ID().String())
	assert.ErrorIs(t, err, domain.ErrNotFound)
}

func TestService_GetPublishedByID_SoftDeletedReturnsNotFound(t *testing.T) {
	// 软删除行不在 FindActiveByID 索引中（模拟 GORM 作用域过滤）；
	// Unscoped FindByID 仍会命中，但公开/MCP 写路径不得写入回收站文章。
	p := mustReconstructPost(t, "trashed", "已删", "正文", "摘要")
	svc := newPublishedSlugTestService()
	_, err := svc.GetPublishedByID(context.Background(), p.ID().String())
	assert.ErrorIs(t, err, domain.ErrNotFound)
}

func TestService_GetPublishedByID_InvalidIDReturnsNotFound(t *testing.T) {
	svc := newPublishedSlugTestService()
	_, err := svc.GetPublishedByID(context.Background(), "not-a-uuid")
	assert.ErrorIs(t, err, domain.ErrNotFound)
}

// reconstructPostWithStatus 构造指定状态的 Post（mustReconstructPost 固定 published）。
func reconstructPostWithStatus(t *testing.T, slug, title, status string) *domain.Post {
	t.Helper()
	return domain.ReconstructPost(
		shared.NewID(), shared.NewID(), title, slug,
		"正文", "<p>html</p>", "摘要", "",
		status, 0, false, false, "", "",
		nil, nil, nil, testTime, testTime,
	)
}
