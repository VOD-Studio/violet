// Package gorm 提供 comment 仓储的 SQLite 测试。
//
// 范式复制 post_repo_test.go：SQLite + AutoMigrate，零外部依赖、毫秒级。
// PostgreSQL 特有语法（partial index）的回归由集成测试覆盖（可选，本期未建）。
package gorm

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	domaincomment "blog-api/internal/domain/comment"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// setupCommentTestDB 初始化 SQLite 测试库并迁移 comment 相关表。
// 同时迁移 user 表，因为 created_by 外键引用 users。
func setupCommentTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	tmpFile := filepath.Join(t.TempDir(), "comment_test.db")
	db, err := gorm.Open(sqlite.Open(tmpFile), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Comment{}))
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

// saveComment 直接用 GORM 写一条评论记录（绕过 domain），便于测试查询逻辑。
//
// withAnchor=true 时填 anchor 5 列，写成批注；否则全空，写自由评论。
// 这样 anchor 维度过滤的测试无需独立 helper。
func saveComment(t *testing.T, db *gorm.DB, status, ipHash, email string, createdBy *string, withAnchor bool) {
	t.Helper()
	c := model.Comment{
		ID:          uuid.New(),
		PostID:      fixedPostID.UUID(),
		Path:        domainshared.NewID().String() + "/",
		Depth:       0,
		AuthorName:  "tester",
		AuthorEmail: email,
		Body:        "hi",
		Pictures:    []byte("[]"),
		Status:      status,
		IPHash:      ipHash,
	}
	if createdBy != nil {
		// SQLite 不强制外键，直接写 UUID 字符串。
		u, err := uuid.Parse(*createdBy)
		require.NoError(t, err)
		c.CreatedBy = &u
	}
	if withAnchor {
		// anchor 5 列：填非空值，标记为批注（具体值对查询过滤无意义，仅 IS [NOT] NULL 判断）。
		blockID := "block-1"
		start := 0
		end := 5
		sel := "选中"
		hash := "hash-1"
		c.AnchorBlockID = &blockID
		c.AnchorStartOffset = &start
		c.AnchorEndOffset = &end
		c.AnchorSelectedText = &sel
		c.AnchorBlockTextHash = &hash
	}
	require.NoError(t, db.Create(&c).Error)
}

// TestCountByPostAndAnon 配额查询：只计 pending/approved，spam/deleted 不占配额。
func TestCountByPostAndAnon(t *testing.T) {
	db := setupCommentTestDB(t)
	repo := NewCommentRepository(db)
	ctx := context.Background()
	pid := fixedPostID
	ip := "iphash1"
	email := "alice@x.com"

	saveComment(t, db, domaincomment.StatusApproved, ip, email, nil, false) // 计
	saveComment(t, db, domaincomment.StatusPending, ip, email, nil, false)  // 计
	saveComment(t, db, domaincomment.StatusSpam, ip, email, nil, false)     // 不计
	saveComment(t, db, domaincomment.StatusDeleted, ip, email, nil, false)  // 不计

	n, err := repo.CountByPostAndAnon(ctx, pid, ip, email)
	require.NoError(t, err)
	assert.Equal(t, int64(2), n, "应只计 pending+approved = 2 条")
}

// TestCountByPostAndAnon_DifferentIdentityNotCounted 不同 (ip,email) 不算同一配额。
func TestCountByPostAndAnon_DifferentIdentityNotCounted(t *testing.T) {
	db := setupCommentTestDB(t)
	repo := NewCommentRepository(db)
	ctx := context.Background()
	pid := fixedPostID

	saveComment(t, db, domaincomment.StatusApproved, "ip1", "alice@x.com", nil, false)
	saveComment(t, db, domaincomment.StatusApproved, "ip1", "bob@x.com", nil, false) // 不同 email
	saveComment(t, db, domaincomment.StatusApproved, "ip2", "alice@x.com", nil, false) // 不同 ip

	// alice@x.com + ip1 应只见 1 条
	n, err := repo.CountByPostAndAnon(ctx, pid, "ip1", "alice@x.com")
	require.NoError(t, err)
	assert.Equal(t, int64(1), n, "不同 email 或 ip 应算不同身份")
}

// TestFindByPost_LoggedInViewer_IncludesOwnPending 登录 viewer 看到 approved ∪ 自己 pending。
func TestFindByPost_LoggedInViewer_IncludesOwnPending(t *testing.T) {
	db := setupCommentTestDB(t)
	repo := NewCommentRepository(db)
	ctx := context.Background()
	pid := fixedPostID
	viewer := domainshared.NewID()
	other := domainshared.NewID()
	viewerStr := viewer.String()
	otherStr := other.String()

	// approved（无主，所有人可见）
	saveComment(t, db, domaincomment.StatusApproved, "ip", "a@x.com", nil, false)
	// viewer 自己的 pending（应可见）
	saveComment(t, db, domaincomment.StatusPending, "ip", "b@x.com", &viewerStr, false)
	// 他人的 pending（不可见）
	saveComment(t, db, domaincomment.StatusPending, "ip", "c@x.com", &otherStr, false)

	items, total, err := repo.FindByPost(ctx, pid, domaincomment.StatusApproved, &viewer, domaincomment.AnchorFilterAll, domaincomment.DepthFilterAll, 1, 50)
	require.NoError(t, err)
	assert.Equal(t, int64(2), total, "应见 approved(1) + 自己 pending(1) = 2")
	statuses := map[string]bool{}
	for _, c := range items {
		statuses[c.Status()] = true
	}
	assert.True(t, statuses[domaincomment.StatusApproved])
	assert.True(t, statuses[domaincomment.StatusPending], "viewer 自己的 pending 应可见")
}

// TestFindByPost_AnonViewer_OnlyApproved（注：service 层会在匿名时短路返回空，
// 不走到这里；但 repo 接口仍要保证：viewer=nil 时仅返回 status 匹配项，不泄漏 pending。）
func TestFindByPost_NilViewer_OnlyApproved(t *testing.T) {
	db := setupCommentTestDB(t)
	repo := NewCommentRepository(db)
	ctx := context.Background()
	pid := fixedPostID
	viewer := domainshared.NewID()
	viewerStr := viewer.String()

	saveComment(t, db, domaincomment.StatusApproved, "ip", "a@x.com", nil, false)
	saveComment(t, db, domaincomment.StatusPending, "ip", "b@x.com", &viewerStr, false) // 即使有 owner，nil viewer 也不可见

	items, total, err := repo.FindByPost(ctx, pid, domaincomment.StatusApproved, nil, domaincomment.AnchorFilterAll, domaincomment.DepthFilterAll, 1, 50)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total, "nil viewer 只见 approved")
	for _, c := range items {
		assert.Equal(t, domaincomment.StatusApproved, c.Status(), "不应泄漏 pending")
	}
}

// TestFindByPost_AnchorFilter_Free_OnlyReturnsFreeComments 自由评论过滤：
// anchorFilter=free 时只返回 anchor_block_id IS NULL 的评论。
func TestFindByPost_AnchorFilter_Free_OnlyReturnsFreeComments(t *testing.T) {
	db := setupCommentTestDB(t)
	repo := NewCommentRepository(db)
	ctx := context.Background()
	pid := fixedPostID

	saveComment(t, db, domaincomment.StatusApproved, "ip", "a@x.com", nil, false) // 自由
	saveComment(t, db, domaincomment.StatusApproved, "ip", "b@x.com", nil, true)  // 批注

	items, total, err := repo.FindByPost(ctx, pid, domaincomment.StatusApproved, nil, domaincomment.AnchorFilterFree, domaincomment.DepthFilterAll, 1, 50)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total, "free 过滤只返回自由评论")
	for _, c := range items {
		assert.Nil(t, c.Anchor(), "free 过滤不应返回批注")
	}
}

// TestFindByPost_AnchorFilter_Annotation_OnlyReturnsAnnotations 批注过滤：
// anchorFilter=annotation 时只返回 anchor_block_id IS NOT NULL 的批注。
func TestFindByPost_AnchorFilter_Annotation_OnlyReturnsAnnotations(t *testing.T) {
	db := setupCommentTestDB(t)
	repo := NewCommentRepository(db)
	ctx := context.Background()
	pid := fixedPostID

	saveComment(t, db, domaincomment.StatusApproved, "ip", "a@x.com", nil, false) // 自由
	saveComment(t, db, domaincomment.StatusApproved, "ip", "b@x.com", nil, true)  // 批注

	items, total, err := repo.FindByPost(ctx, pid, domaincomment.StatusApproved, nil, domaincomment.AnchorFilterAnnotation, domaincomment.DepthFilterAll, 1, 50)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total, "annotation 过滤只返回批注")
	for _, c := range items {
		require.NotNil(t, c.Anchor(), "annotation 过滤应返回批注")
	}
}

// TestFindPending_AnchorFilterAnnotation_OnlyReturnsAnnotations FindPending 的 anchor 维度过滤：
// anchorFilter=annotation 时只返回批注（FindAll 因需 join posts 在 SQLite 测试里成本高，
// anchor WHERE 逻辑与 FindPending 同构，由 FindPending 用例覆盖）。
func TestFindPending_AnchorFilterAnnotation_OnlyReturnsAnnotations(t *testing.T) {
	db := setupCommentTestDB(t)
	repo := NewCommentRepository(db)
	ctx := context.Background()

	saveComment(t, db, domaincomment.StatusPending, "ip", "a@x.com", nil, false) // 自由评论
	saveComment(t, db, domaincomment.StatusPending, "ip", "b@x.com", nil, true)  // 批注

	items, total, err := repo.FindPending(ctx, domaincomment.AnchorFilterAnnotation, 1, 50)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total, "annotation 过滤只返回批注")
	for _, c := range items {
		require.NotNil(t, c.Anchor(), "annotation 过滤应返回批注")
	}
}

// TestFindPending_AnchorFilterFree_OnlyReturnsFreeComments FindPending 的 anchor 维度过滤：
// anchorFilter=free 时只返回自由评论。
func TestFindPending_AnchorFilterFree_OnlyReturnsFreeComments(t *testing.T) {
	db := setupCommentTestDB(t)
	repo := NewCommentRepository(db)
	ctx := context.Background()

	saveComment(t, db, domaincomment.StatusPending, "ip", "a@x.com", nil, false) // 自由评论
	saveComment(t, db, domaincomment.StatusPending, "ip", "b@x.com", nil, true)  // 批注

	items, total, err := repo.FindPending(ctx, domaincomment.AnchorFilterFree, 1, 50)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total, "free 过滤只返回自由评论")
	for _, c := range items {
		assert.Nil(t, c.Anchor(), "free 过滤不应返回批注")
	}
}

// TestFindPending_AnchorFilterAll_ReturnsBoth FindPending 的 anchor 维度过滤：
// anchorFilter=all（后台默认）时返回自由评论 + 批注全部。
func TestFindPending_AnchorFilterAll_ReturnsBoth(t *testing.T) {
	db := setupCommentTestDB(t)
	repo := NewCommentRepository(db)
	ctx := context.Background()

	saveComment(t, db, domaincomment.StatusPending, "ip", "a@x.com", nil, false) // 自由评论
	saveComment(t, db, domaincomment.StatusPending, "ip", "b@x.com", nil, true)  // 批注

	items, total, err := repo.FindPending(ctx, domaincomment.AnchorFilterAll, 1, 50)
	require.NoError(t, err)
	assert.Equal(t, int64(2), total, "all 过滤返回自由评论 + 批注全部")
	hasAnchor := false
	hasFree := false
	for _, c := range items {
		if c.Anchor() != nil {
			hasAnchor = true
		} else {
			hasFree = true
		}
	}
	assert.True(t, hasAnchor && hasFree, "all 应同时包含批注与自由评论")
}

// TestFindByPost_DepthFilterTopLevel_OnlyReturnsTopLevel depth 过滤：
// DepthFilterTopLevel 时只返回 depth=0 的顶层评论，回复（depth=1）被排除。
// 避免顶层评论和回复混在一页被分页切走（按需拉回复分页策略的基础）。
func TestFindByPost_DepthFilterTopLevel_OnlyReturnsTopLevel(t *testing.T) {
	db := setupCommentTestDB(t)
	repo := NewCommentRepository(db)
	ctx := context.Background()
	pid := fixedPostID

	// 顶层评论（depth=0）
	saveCommentWithDepth(t, db, domaincomment.StatusApproved, "ip", "a@x.com", nil, false, 0, domainshared.NewID().String()+"/")
	// 回复（depth=1）
	saveCommentWithDepth(t, db, domaincomment.StatusApproved, "ip", "b@x.com", nil, false, 1, domainshared.NewID().String()+"/")

	items, total, err := repo.FindByPost(ctx, pid, domaincomment.StatusApproved, nil, domaincomment.AnchorFilterAll, domaincomment.DepthFilterTopLevel, 1, 50)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total, "DepthFilterTopLevel 只返回顶层评论")
	for _, c := range items {
		assert.Equal(t, int16(0), c.Depth(), "DepthFilterTopLevel 应只返回 depth=0")
	}
}

// TestFindReplies_ReturnsRepliesUnderTopLevel 按 path 前缀查回复，排除父自身。
// 造一条顶层（path="<topID>/"）+ 两条回复（path="<topID>/<replyID>/"），查 FindReplies 应返回 2 条回复。
func TestFindReplies_ReturnsRepliesUnderTopLevel(t *testing.T) {
	db := setupCommentTestDB(t)
	repo := NewCommentRepository(db)
	ctx := context.Background()
	pid := fixedPostID

	topID := uuid.New()
	topPath := topID.String() + "/"
	// 顶层评论
	require.NoError(t, db.Create(&model.Comment{
		ID: topID, PostID: pid.UUID(), Path: topPath, Depth: 0,
		AuthorName: "alice", Body: "top", Pictures: []byte("[]"),
		Status: domaincomment.StatusApproved,
	}).Error)
	// 两条回复（path 挂顶层下）
	saveCommentWithDepth(t, db, domaincomment.StatusApproved, "ip", "b@x.com", nil, false, 1, topPath+uuid.New().String()+"/")
	saveCommentWithDepth(t, db, domaincomment.StatusApproved, "ip", "c@x.com", nil, false, 1, topPath+uuid.New().String()+"/")

	items, total, err := repo.FindReplies(ctx, domainshared.MustParseID(topID.String()), domaincomment.StatusApproved, nil, "asc", 1, 50)
	require.NoError(t, err)
	assert.Equal(t, int64(2), total, "应返回 2 条回复（排除父自身）")
	for _, c := range items {
		assert.Equal(t, int16(1), c.Depth(), "FindReplies 返回的都应是回复（depth=1）")
	}
}

// TestFindReplies_SortDesc 验证 sort=desc 按最新优先返回。
func TestFindReplies_SortDesc(t *testing.T) {
	db := setupCommentTestDB(t)
	repo := NewCommentRepository(db)
	ctx := context.Background()
	pid := fixedPostID

	topID := uuid.New()
	topPath := topID.String() + "/"
	require.NoError(t, db.Create(&model.Comment{
		ID: topID, PostID: pid.UUID(), Path: topPath, Depth: 0,
		AuthorName: "alice", Body: "top", Pictures: []byte("[]"),
		Status: domaincomment.StatusApproved, CreatedAt: time.Now().Add(-2 * time.Minute),
	}).Error)

	// 两条回复，时间差 1 分钟
	oldReply := model.Comment{
		ID: uuid.New(), PostID: pid.UUID(), Path: topPath + uuid.New().String() + "/",
		Depth: 1, AuthorName: "bob", Body: "old", Pictures: []byte("[]"),
		Status: domaincomment.StatusApproved, CreatedAt: time.Now().Add(-1 * time.Minute),
	}
	newReply := model.Comment{
		ID: uuid.New(), PostID: pid.UUID(), Path: topPath + uuid.New().String() + "/",
		Depth: 1, AuthorName: "carol", Body: "new", Pictures: []byte("[]"),
		Status: domaincomment.StatusApproved, CreatedAt: time.Now(),
	}
	require.NoError(t, db.Create(&oldReply).Error)
	require.NoError(t, db.Create(&newReply).Error)

	items, _, err := repo.FindReplies(ctx, domainshared.MustParseID(topID.String()), domaincomment.StatusApproved, nil, "desc", 1, 50)
	require.NoError(t, err)
	require.Len(t, items, 2)
	assert.Equal(t, "new", items[0].Body(), "desc 排序：最新的在前")
	assert.Equal(t, "old", items[1].Body())
}

// TestFindReplies_ViewerFilter_ExcludesOtherPending 验证回复计数与列表不泄漏他人的 pending：
// viewer 是 alice，能看到 approved 回复 + 自己的 pending 回复，看不到 bob 的 pending 回复。
// 这个用例钉死「未审核的回复不应被计入 replies_total」契约。
func TestFindReplies_ViewerFilter_ExcludesOtherPending(t *testing.T) {
	db := setupCommentTestDB(t)
	repo := NewCommentRepository(db)
	ctx := context.Background()
	pid := fixedPostID
	aliceID := uuid.New()
	bobID := uuid.New()
	aliceStr := aliceID.String()
	bobStr := bobID.String()

	topID := uuid.New()
	topPath := topID.String() + "/"
	require.NoError(t, db.Create(&model.Comment{
		ID: topID, PostID: pid.UUID(), Path: topPath, Depth: 0,
		AuthorName: "topauthor", Body: "top", Pictures: []byte("[]"),
		Status: domaincomment.StatusApproved,
	}).Error)

	// approved 回复（无主，所有人可见）
	saveCommentWithDepth(t, db, domaincomment.StatusApproved, "ip", "a@x.com", nil, false, 1, topPath+uuid.New().String()+"/")
	// alice 自己的 pending 回复（alice 可见）
	saveCommentWithDepth(t, db, domaincomment.StatusPending, "ip", "alice@x.com", &aliceStr, false, 1, topPath+uuid.New().String()+"/")
	// bob 的 pending 回复（alice 不可见）
	saveCommentWithDepth(t, db, domaincomment.StatusPending, "ip", "bob@x.com", &bobStr, false, 1, topPath+uuid.New().String()+"/")

	aliceViewer := domainshared.MustParseID(aliceStr)
	items, total, err := repo.FindReplies(ctx, domainshared.MustParseID(topID.String()), domaincomment.StatusApproved, &aliceViewer, "asc", 1, 50)
	require.NoError(t, err)
	// alice 应见 approved(1) + 自己 pending(1) = 2，bob 的 pending 不计入
	assert.Equal(t, int64(2), total, "viewer 不应看到他人的 pending 回复被计入 total")
	assert.Len(t, items, 2, "viewer 不应看到他人的 pending 回复出现在列表")
}

// saveCommentWithDepth saveComment 的扩展版，支持指定 depth + path。
// 用于测试 depth 维度过滤与 FindReplies（saveComment 默认造的都是 depth=0、随机 path）。
func saveCommentWithDepth(t *testing.T, db *gorm.DB, status, ipHash, email string, createdBy *string, withAnchor bool, depth int16, path string) {
	t.Helper()
	c := model.Comment{
		ID: uuid.New(), PostID: fixedPostID.UUID(),
		Path: path,
		Depth: depth, AuthorName: "tester", AuthorEmail: email,
		Body: "hi", Pictures: []byte("[]"), Status: status, IPHash: ipHash,
	}
	if createdBy != nil {
		u, err := uuid.Parse(*createdBy)
		require.NoError(t, err)
		c.CreatedBy = &u
	}
	if withAnchor {
		blockID := "block-1"
		c.AnchorBlockID = &blockID
	}
	require.NoError(t, db.Create(&c).Error)
}

// fixedPostID 测试用固定 post id（SQLite 不强制外键，无需真实 post 记录）。
var fixedPostID = domainshared.NewID()

// TestSaveAndFind_RoundTripAnchor 验证 anchor 5 列 round-trip（domain → PO → DB → PO → domain）。
// Issue-0003：批注的 anchor 写入后读出应保持一致。
func TestSaveAndFind_RoundTripAnchor(t *testing.T) {
	db := setupCommentTestDB(t)
	repo := NewCommentRepository(db)
	ctx := context.Background()

	userID := domainshared.NewID()
	postID := domainshared.NewID()
	anchor := &domaincomment.Anchor{
		BlockID:       "abc12345",
		StartOffset:   3,
		EndOffset:     9,
		SelectedText:  "hello world",
		BlockHashSync: "deadbeef",
	}
	c, err := domaincomment.NewComment(domaincomment.CreateParams{
		ID: domainshared.NewID(), PostID: postID, UserID: &userID,
		AuthorName: "annotator", AuthorEmail: "a@x.com",
		Body: "note", Anchor: anchor,
	})
	require.NoError(t, err)
	require.NoError(t, c.SetParent(nil))

	require.NoError(t, repo.Save(ctx, c))

	got, err := repo.FindByID(ctx, c.ID())
	require.NoError(t, err)
	gotAnchor := got.Anchor()
	require.NotNil(t, gotAnchor, "批注的 anchor 重建后不应为 nil")
	assert.Equal(t, "abc12345", gotAnchor.BlockID)
	assert.Equal(t, 3, gotAnchor.StartOffset)
	assert.Equal(t, 9, gotAnchor.EndOffset)
	assert.Equal(t, "hello world", gotAnchor.SelectedText)
	assert.Equal(t, "deadbeef", gotAnchor.BlockHashSync)
	assert.Equal(t, userID.String(), got.UserID().String(), "批注的 created_by 也应 round-trip")
}

// TestSaveAndFind_FreeCommentHasNilAnchor 自由评论（无 anchor）round-trip 后 anchor 仍为 nil。
func TestSaveAndFind_FreeCommentHasNilAnchor(t *testing.T) {
	db := setupCommentTestDB(t)
	repo := NewCommentRepository(db)
	ctx := context.Background()

	userID := domainshared.NewID()
	c, err := domaincomment.NewComment(domaincomment.CreateParams{
		ID: domainshared.NewID(), PostID: fixedPostID, UserID: &userID,
		AuthorName: "bob", Body: "free comment",
	})
	require.NoError(t, err)
	require.NoError(t, c.SetParent(nil))
	require.NoError(t, repo.Save(ctx, c))

	got, err := repo.FindByID(ctx, c.ID())
	require.NoError(t, err)
	assert.Nil(t, got.Anchor(), "自由评论的 anchor 应为 nil")
}

// TestSave_RoundTripPictures pictures 写入后读出一致（Issue-0003 pictures 接线）。
func TestSave_RoundTripPictures(t *testing.T) {
	db := setupCommentTestDB(t)
	repo := NewCommentRepository(db)
	ctx := context.Background()

	userID := domainshared.NewID()
	c, err := domaincomment.NewComment(domaincomment.CreateParams{
		ID: domainshared.NewID(), PostID: fixedPostID, UserID: &userID,
		AuthorName: "bob", Body: "with pics",
	})
	require.NoError(t, err)
	c.SetPictures([]domaincomment.Picture{
		{URL: "https://x/a.png", Width: 100, Height: 200, Size: 1024},
	})
	require.NoError(t, c.SetParent(nil))
	require.NoError(t, repo.Save(ctx, c))

	got, err := repo.FindByID(ctx, c.ID())
	require.NoError(t, err)
	require.Len(t, got.Pictures(), 1)
	assert.Equal(t, "https://x/a.png", got.Pictures()[0].URL)
	assert.Equal(t, 100, got.Pictures()[0].Width)
	assert.Equal(t, int64(1024), got.Pictures()[0].Size)
}
