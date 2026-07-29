package post

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domain "blog-api/internal/domain/post"
	"blog-api/internal/domain/shared"
)

// fakePublishedSlugRepo 覆盖 FindBySlug，按 slug 返回预设文章（或 ErrNotFound）。
// 其余方法继承 fakeSlugRepo（panic），保证测试范围不越界。
type fakePublishedSlugRepo struct {
	fakeSlugRepo
	bySlug map[string]*domain.Post
}

func (f *fakePublishedSlugRepo) FindBySlug(_ context.Context, slug string) (*domain.Post, error) {
	p, ok := f.bySlug[slug]
	if !ok {
		return nil, domain.ErrNotFound
	}
	return p, nil
}

func newPublishedSlugTestService(posts ...*domain.Post) *Service {
	m := make(map[string]*domain.Post, len(posts))
	for _, p := range posts {
		m[p.Slug()] = p
	}
	return &Service{repo: &fakePublishedSlugRepo{bySlug: m}}
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

// reconstructPostWithStatus 构造指定状态的 Post（mustReconstructPost 固定 published）。
func reconstructPostWithStatus(t *testing.T, slug, title, status string) *domain.Post {
	t.Helper()
	return domain.ReconstructPost(
		shared.NewID(), shared.NewID(), title, slug,
		"正文", "<p>html</p>", "摘要", "",
		status, 0, false, "", "",
		nil, nil, nil, testTime, testTime,
	)
}
