package comment

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	domain "blog-api/internal/domain/comment"
	"blog-api/internal/domain/shared"
	"blog-api/internal/application/mocks"
)

func TestService_SearchComments(t *testing.T) {
	svc, repo, _, _ := newServiceWithMocks(nil)
	pid := shared.NewID()
	repo.On("FindPageWithPost", mock.Anything, domain.ListFilter{
		Status: domain.StatusApproved, AnchorFilter: domain.AnchorFilterAll, Query: "公式",
	}, shared.PageQuery{Page: 1, Limit: 20}).
		Return(shared.NewPageResult(shared.PageQuery{Page: 1, Limit: 20}, []*domain.CommentWithPost{
			{Comment: mustReconstructComment(t, "公式写错了"), Post: domain.PostRef{ID: pid, Title: "T", Slug: "t"}},
		}, 1), nil)

	res, err := svc.SearchComments(context.Background(), "公式", domain.AnchorFilterAll, 20, 0)
	require.NoError(t, err)
	assert.Equal(t, int64(1), res.TotalCount)
	require.Len(t, res.Comments, 1)
	assert.Contains(t, res.Comments[0].Body, "公式")
	assert.Equal(t, "t", res.Comments[0].PostSlug)
}

func TestService_SearchComments_LimitDefault(t *testing.T) {
	svc, repo, _, _ := newServiceWithMocks(nil)
	repo.On("FindPageWithPost", mock.Anything, domain.ListFilter{
		Status: domain.StatusApproved, AnchorFilter: domain.AnchorFilterAll, Query: "x",
	}, shared.PageQuery{Page: 1, Limit: 20}).
		Return(shared.PageResult[*domain.CommentWithPost]{}, nil)

	// limit=0 → 默认 20；offset 0 → page 1
	_, err := svc.SearchComments(context.Background(), "x", domain.AnchorFilterAll, 0, 0)
	require.NoError(t, err)
}

func TestService_SearchComments_OffsetToPage(t *testing.T) {
	svc, repo, _, _ := newServiceWithMocks(nil)
	// offset 20 / limit 20 → page 2
	repo.On("FindPageWithPost", mock.Anything, domain.ListFilter{
		Status: domain.StatusApproved, AnchorFilter: domain.AnchorFilterAll, Query: "x",
	}, shared.PageQuery{Page: 2, Limit: 20}).
		Return(shared.PageResult[*domain.CommentWithPost]{}, nil)

	_, err := svc.SearchComments(context.Background(), "x", domain.AnchorFilterAll, 20, 20)
	require.NoError(t, err)
}

func TestService_ListRecentComments(t *testing.T) {
	svc, repo, _, _ := newServiceWithMocks(nil)
	pid := shared.NewID()
	repo.On("FindPageWithPost", mock.Anything, domain.ListFilter{
		Status: domain.StatusApproved, AnchorFilter: domain.AnchorFilterAll,
	}, shared.PageQuery{Page: 1, Limit: 20}).
		Return(shared.NewPageResult(shared.PageQuery{Page: 1, Limit: 20}, []*domain.CommentWithPost{
			{Comment: mustReconstructComment(t, "最新评论"), Post: domain.PostRef{ID: pid, Title: "T", Slug: "t"}},
		}, 1), nil)

	res, err := svc.ListRecentComments(context.Background(), domain.AnchorFilterAll, 20, 0)
	require.NoError(t, err)
	assert.Equal(t, int64(1), res.TotalCount)
	require.Len(t, res.Comments, 1)
}

func TestService_CommentStats(t *testing.T) {
	svc, repo, _, _ := newServiceWithMocks(nil)
	pid1 := shared.NewID()
	pid2 := shared.NewID()
	repo.On("Stats", mock.Anything, domain.StatusApproved).
		Return([]domain.PostCommentStat{
			{PostID: pid1, PostTitle: "一", PostSlug: "s1", AnnotationCount: 2, CommentCount: 3},
			{PostID: pid2, PostTitle: "二", PostSlug: "s2", AnnotationCount: 1, CommentCount: 1},
		}, nil)

	res, err := svc.CommentStats(context.Background())
	require.NoError(t, err)
	// 汇总
	assert.Equal(t, int64(3), res.Summary.TotalAnnotations, "2+1")
	assert.Equal(t, int64(4), res.Summary.TotalComments, "3+1")
	assert.Equal(t, int64(2), res.Summary.PostsWithFeedback)
	// 明细按仓储返回顺序（已 annotation_count DESC）
	require.Len(t, res.Posts, 2)
	assert.Equal(t, "s1", res.Posts[0].PostSlug)
	assert.Equal(t, int64(2), res.Posts[0].AnnotationCount)
}

func TestService_CommentStats_Empty(t *testing.T) {
	svc, repo, _, _ := newServiceWithMocks(nil)
	repo.On("Stats", mock.Anything, domain.StatusApproved).Return([]domain.PostCommentStat{}, nil)

	res, err := svc.CommentStats(context.Background())
	require.NoError(t, err)
	assert.Empty(t, res.Posts)
	assert.Equal(t, int64(0), res.Summary.TotalAnnotations)
	assert.Equal(t, int64(0), res.Summary.PostsWithFeedback)
}

// mustReconstructComment 构造带 body 的 Comment（测试用，绕过 NewComment 校验）。
func mustReconstructComment(t *testing.T, body string) *domain.Comment {
	t.Helper()
	return domain.ReconstructComment(
		shared.NewID(), shared.NewID(), nil, nil, "", 0,
		nil, "tester", "t@x.com", "", "", body, nil,
		domain.StatusApproved, "iph", "ua", time.Now(), time.Now(),
	)
}

// 抑制未用 import（mocks 包用于 newServiceWithMocks 内部）。
var _ = mocks.MockCommentRepository{}
