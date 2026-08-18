package gorm

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	domaincomment "blog-api/internal/domain/comment"
	domainpost "blog-api/internal/domain/post"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// setupCommentSearchTestDB 初始化含 user/comment/post 三表的测试库（Search/Stats 的 JOIN 需要 post）。
func setupCommentSearchTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db := setupCommentTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Post{}))
	return db
}

// savePostWithID 建一篇指定 id 的 post（Stats/Search 的 JOIN 取 title/slug 需要）。
func savePostWithID(t *testing.T, db *gorm.DB, id domainshared.ID, title, slug string) {
	t.Helper()
	require.NoError(t, db.Create(&model.Post{
		ID:     id.UUID(),
		Title:  title,
		Slug:   slug,
		Status: domainpost.StatusPublished,
	}).Error)
}

// saveCommentWithBody 带 body + postID 的评论写入（检索 body 内容用）。
func saveCommentWithBody(t *testing.T, db *gorm.DB, postID uuid.UUID, body, status string, withAnchor bool) {
	t.Helper()
	c := model.Comment{
		ID:          uuid.New(),
		PostID:      postID,
		Path:        domainshared.NewID().String() + "/",
		Depth:       0,
		AuthorName:  "tester",
		AuthorEmail: "t@x.com",
		Body:        body,
		Pictures:    []byte("[]"),
		Status:      status,
		IPHash:      "iph",
	}
	if withAnchor {
		blockID := "blk"
		s, e := 0, 5
		sel, hash := "选中原文", "h"
		c.AnchorBlockID = &blockID
		c.AnchorStartOffset = &s
		c.AnchorEndOffset = &e
		c.AnchorSelectedText = &sel
		c.AnchorBlockTextHash = &hash
	}
	require.NoError(t, db.Create(&c).Error)
}

func TestCommentRepository_Search_BodyKeyword(t *testing.T) {
	db := setupCommentSearchTestDB(t)
	repo := NewCommentRepository(db)
	ctx := context.Background()
	pid := fixedPostID
	savePostWithID(t, db, pid, "量子计算", "quantum")

	saveCommentWithBody(t, db, pid.UUID(), "这段公式写错了", domaincomment.StatusApproved, false)
	saveCommentWithBody(t, db, pid.UUID(), "讲得很清楚", domaincomment.StatusApproved, false)

	// 关键词「公式」只命中第一条
	result, err := repo.FindPageWithPost(ctx, domaincomment.ListFilter{Status: domaincomment.StatusApproved, Query: "公式", AnchorFilter: domaincomment.AnchorFilterAll}, domainshared.PageQuery{Page: 1, Limit: 20})
	require.NoError(t, err)
	assert.Equal(t, int64(1), result.Total)
	require.Len(t, result.Items, 1)
	assert.Contains(t, result.Items[0].Comment.Body(), "公式")
	// JOIN 取到 post 信息
	assert.Equal(t, "quantum", result.Items[0].Post.Slug)
}

func TestCommentRepository_Search_MultiKeywordAND(t *testing.T) {
	db := setupCommentSearchTestDB(t)
	repo := NewCommentRepository(db)
	ctx := context.Background()
	pid := fixedPostID
	savePostWithID(t, db, pid, "T", "t")

	saveCommentWithBody(t, db, pid.UUID(), "公式 错误 这里", domaincomment.StatusApproved, false) // 两词都命中
	saveCommentWithBody(t, db, pid.UUID(), "公式 正确", domaincomment.StatusApproved, false)       // 只命中公式

	result, err := repo.FindPageWithPost(ctx, domaincomment.ListFilter{Status: domaincomment.StatusApproved, Query: "公式 错误", AnchorFilter: domaincomment.AnchorFilterAll}, domainshared.PageQuery{Page: 1, Limit: 20})
	require.NoError(t, err)
	assert.Equal(t, int64(1), result.Total, "多关键词 AND，缺一词不命中")
	require.Len(t, result.Items, 1)
}

func TestCommentRepository_Search_StatusFilter(t *testing.T) {
	db := setupCommentSearchTestDB(t)
	repo := NewCommentRepository(db)
	ctx := context.Background()
	pid := fixedPostID
	savePostWithID(t, db, pid, "T", "t")

	saveCommentWithBody(t, db, pid.UUID(), "公式 approved", domaincomment.StatusApproved, false)
	saveCommentWithBody(t, db, pid.UUID(), "公式 pending", domaincomment.StatusPending, false)

	// MCP 固定传 approved，pending 不命中
	result, err := repo.FindPageWithPost(ctx, domaincomment.ListFilter{Status: domaincomment.StatusApproved, Query: "公式", AnchorFilter: domaincomment.AnchorFilterAll}, domainshared.PageQuery{Page: 1, Limit: 20})
	require.NoError(t, err)
	assert.Equal(t, int64(1), result.Total)
	require.Len(t, result.Items, 1)
	assert.Contains(t, result.Items[0].Comment.Body(), "approved")
}

func TestCommentRepository_Search_AnchorFilter(t *testing.T) {
	db := setupCommentSearchTestDB(t)
	repo := NewCommentRepository(db)
	ctx := context.Background()
	pid := fixedPostID
	savePostWithID(t, db, pid, "T", "t")

	saveCommentWithBody(t, db, pid.UUID(), "自由评论", domaincomment.StatusApproved, false)
	saveCommentWithBody(t, db, pid.UUID(), "批注反馈", domaincomment.StatusApproved, true)

	// type=annotation 只命中批注
	ann, err := repo.FindPageWithPost(ctx, domaincomment.ListFilter{Status: domaincomment.StatusApproved, Query: "", AnchorFilter: domaincomment.AnchorFilterAnnotation}, domainshared.PageQuery{Page: 1, Limit: 20})
	require.NoError(t, err)
	assert.Equal(t, int64(1), ann.Total)
	require.Len(t, ann.Items, 1)
	assert.Contains(t, ann.Items[0].Comment.Body(), "批注")

	// type=free 只命中自由评论
	free, err := repo.FindPageWithPost(ctx, domaincomment.ListFilter{Status: domaincomment.StatusApproved, Query: "", AnchorFilter: domaincomment.AnchorFilterFree}, domainshared.PageQuery{Page: 1, Limit: 20})
	require.NoError(t, err)
	assert.Equal(t, int64(1), free.Total)
	require.Len(t, free.Items, 1)
	assert.Contains(t, free.Items[0].Comment.Body(), "自由")
}

func TestCommentRepository_Search_CaseInsensitiveChinese(t *testing.T) {
	db := setupCommentSearchTestDB(t)
	repo := NewCommentRepository(db)
	ctx := context.Background()
	pid := fixedPostID
	savePostWithID(t, db, pid, "T", "t")

	saveCommentWithBody(t, db, pid.UUID(), "Python 代码有问题", domaincomment.StatusApproved, false)

	// 中文子串精确命中；英文大小写不敏感
	result, err := repo.FindPageWithPost(ctx, domaincomment.ListFilter{Status: domaincomment.StatusApproved, Query: "python", AnchorFilter: domaincomment.AnchorFilterAll}, domainshared.PageQuery{Page: 1, Limit: 20})
	require.NoError(t, err)
	assert.Equal(t, int64(1), result.Total, "LOWER 大小写不敏感应命中 Python")
	require.Len(t, result.Items, 1)
}

func TestCommentRepository_Search_OffsetBeyondReturnsEmpty(t *testing.T) {
	db := setupCommentSearchTestDB(t)
	repo := NewCommentRepository(db)
	ctx := context.Background()
	pid := fixedPostID
	savePostWithID(t, db, pid, "T", "t")
	saveCommentWithBody(t, db, pid.UUID(), "命中", domaincomment.StatusApproved, false)

	// offset 超出：列表空但 has_more 由 total 计算（total 仍为 1）
	result, err := repo.FindPageWithPost(ctx, domaincomment.ListFilter{Status: domaincomment.StatusApproved, Query: "命中", AnchorFilter: domaincomment.AnchorFilterAll}, domainshared.PageQuery{Page: 2, Limit: 20})
	require.NoError(t, err)
	assert.Equal(t, int64(1), result.Total)
	assert.Empty(t, result.Items)
}

func TestCommentRepository_Stats_Aggregation(t *testing.T) {
	db := setupCommentSearchTestDB(t)
	repo := NewCommentRepository(db)
	ctx := context.Background()
	pid1 := fixedPostID
	pid2 := domainshared.NewID()
	savePostWithID(t, db, pid1, "文章一", "post-1")
	savePostWithID(t, db, pid2, "文章二", "post-2")

	// pid1: 2 批注 + 1 自由评论（approved）
	saveCommentWithBody(t, db, pid1.UUID(), "批注1", domaincomment.StatusApproved, true)
	saveCommentWithBody(t, db, pid1.UUID(), "批注2", domaincomment.StatusApproved, true)
	saveCommentWithBody(t, db, pid1.UUID(), "自由1", domaincomment.StatusApproved, false)
	// pid2: 1 批注（approved）
	saveCommentWithBody(t, db, pid2.UUID(), "批注3", domaincomment.StatusApproved, true)
	// pending 不计
	saveCommentWithBody(t, db, pid1.UUID(), "待审", domaincomment.StatusPending, true)

	stats, err := repo.Stats(ctx, domaincomment.StatusApproved)
	require.NoError(t, err)
	require.Len(t, stats, 2, "仅含有反馈的 2 篇文章")

	// 按 annotation_count DESC：pid1(2) 在前，pid2(1) 在后
	assert.Equal(t, pid1.UUID(), stats[0].PostID.UUID())
	assert.Equal(t, int64(2), stats[0].AnnotationCount)
	assert.Equal(t, int64(3), stats[0].CommentCount, "pid1 总评论 = 2批注+1自由")
	assert.Equal(t, "post-1", stats[0].PostSlug)

	assert.Equal(t, pid2.UUID(), stats[1].PostID.UUID())
	assert.Equal(t, int64(1), stats[1].AnnotationCount)
	assert.Equal(t, int64(1), stats[1].CommentCount)
}

func TestCommentRepository_Stats_ExcludesPostsWithoutFeedback(t *testing.T) {
	db := setupCommentSearchTestDB(t)
	repo := NewCommentRepository(db)
	ctx := context.Background()
	pidWith := fixedPostID
	pidWithout := domainshared.NewID()
	savePostWithID(t, db, pidWith, "有反馈", "with")
	savePostWithID(t, db, pidWithout, "无反馈", "without") // 这篇无评论

	saveCommentWithBody(t, db, pidWith.UUID(), "x", domaincomment.StatusApproved, true)

	stats, err := repo.Stats(ctx, domaincomment.StatusApproved)
	require.NoError(t, err)
	require.Len(t, stats, 1, "零反馈文章不列入")
	assert.Equal(t, pidWith.UUID(), stats[0].PostID.UUID())
}
