// Package gorm 提供 comment 仓储的 SQLite 测试。
//
// 范式复制 post_repo_test.go：SQLite + AutoMigrate，零外部依赖、毫秒级。
// PostgreSQL 特有语法（partial index）的回归由集成测试覆盖（可选，本期未建）。
package gorm

import (
	"context"
	"path/filepath"
	"testing"

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
func saveComment(t *testing.T, db *gorm.DB, status, ipHash, email string, createdBy *string) {
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

	saveComment(t, db, domaincomment.StatusApproved, ip, email, nil) // 计
	saveComment(t, db, domaincomment.StatusPending, ip, email, nil)  // 计
	saveComment(t, db, domaincomment.StatusSpam, ip, email, nil)     // 不计
	saveComment(t, db, domaincomment.StatusDeleted, ip, email, nil)  // 不计

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

	saveComment(t, db, domaincomment.StatusApproved, "ip1", "alice@x.com", nil)
	saveComment(t, db, domaincomment.StatusApproved, "ip1", "bob@x.com", nil) // 不同 email
	saveComment(t, db, domaincomment.StatusApproved, "ip2", "alice@x.com", nil) // 不同 ip

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
	saveComment(t, db, domaincomment.StatusApproved, "ip", "a@x.com", nil)
	// viewer 自己的 pending（应可见）
	saveComment(t, db, domaincomment.StatusPending, "ip", "b@x.com", &viewerStr)
	// 他人的 pending（不可见）
	saveComment(t, db, domaincomment.StatusPending, "ip", "c@x.com", &otherStr)

	items, total, err := repo.FindByPost(ctx, pid, domaincomment.StatusApproved, &viewer, 1, 50)
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

	saveComment(t, db, domaincomment.StatusApproved, "ip", "a@x.com", nil)
	saveComment(t, db, domaincomment.StatusPending, "ip", "b@x.com", &viewerStr) // 即使有 owner，nil viewer 也不可见

	items, total, err := repo.FindByPost(ctx, pid, domaincomment.StatusApproved, nil, 1, 50)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total, "nil viewer 只见 approved")
	for _, c := range items {
		assert.Equal(t, domaincomment.StatusApproved, c.Status(), "不应泄漏 pending")
	}
}

// fixedPostID 测试用固定 post id（SQLite 不强制外键，无需真实 post 记录）。
var fixedPostID = domainshared.NewID()
