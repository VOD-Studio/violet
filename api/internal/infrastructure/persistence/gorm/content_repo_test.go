// Package gorm 提供 announcement / project 仓储的 SQLite 集成测试。
//
// 范式复制 repository_test.go：SQLite 临时文件 + AutoMigrate，零外部依赖、毫秒级。
package gorm

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	domainannouncement "blog-api/internal/domain/announcement"
	domainproject "blog-api/internal/domain/project"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// setupContentTestDB 初始化 SQLite 测试库并迁移 announcement / project 表。
func setupContentTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	tmpFile := filepath.Join(t.TempDir(), "content_test.db")
	db, err := gorm.Open(sqlite.Open(tmpFile), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Announcement{}, &model.Project{}))
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

// ============================================================
// AnnouncementRepository 集成测试
// ============================================================

func TestAnnouncementRepository_Lifecycle(t *testing.T) {
	db := setupContentTestDB(t)
	repo := NewAnnouncementRepository(db)
	ctx := context.Background()

	// Save（创建）：一条启用 + 一条停用
	active, err := domainannouncement.NewAnnouncement(0, "活跃公告", "内容 A", domainannouncement.SeverityInfo)
	require.NoError(t, err)
	active.SetSortOrder(2)
	activeID, err := repo.Save(ctx, active)
	require.NoError(t, err)
	require.NotZero(t, activeID)

	inactive, err := domainannouncement.NewAnnouncement(0, "停用公告", "内容 B", domainannouncement.SeverityWarning)
	require.NoError(t, err)
	inactive.SetSortOrder(1)
	inactiveID, err := repo.Save(ctx, inactive) // 创建：领域不变量为 is_active=true
	require.NoError(t, err)
	require.NotZero(t, inactiveID)

	// 停用第二条经「更新路径」Save：db.Save 全字段写入，is_active=false 生效。
	// 不在创建时置 false——model.Announcement.IsActive 带 default:true，
	// GORM Create 会把 bool 零值 false 当作缺省回填为 true（Create 的已知零值行为）。
	loaded, err := repo.FindByID(ctx, inactiveID)
	require.NoError(t, err)
	loaded.SetActive(false)
	_, err = repo.Save(ctx, loaded)
	require.NoError(t, err)

	// FindByID
	got, err := repo.FindByID(ctx, activeID)
	require.NoError(t, err)
	assert.Equal(t, "活跃公告", got.Title())
	assert.Equal(t, "内容 A", got.Content())
	assert.Equal(t, domainannouncement.SeverityInfo, got.Severity())
	assert.Equal(t, 2, got.SortOrder())
	assert.True(t, got.IsActive())

	// FindAll：按 sort_order ASC, created_at DESC → sort_order=1（停用）在前
	all, err := repo.FindAll(ctx)
	require.NoError(t, err)
	require.Len(t, all, 2)
	assert.Equal(t, "停用公告", all[0].Title(), "sort_order 更小者应排在前面")
	assert.Equal(t, "活跃公告", all[1].Title())

	// FindActive：仅返回 is_active=true 且在生效区间内的
	actives, err := repo.FindActive(ctx)
	require.NoError(t, err)
	require.Len(t, actives, 1)
	assert.Equal(t, "活跃公告", actives[0].Title())

	// Delete
	require.NoError(t, repo.Delete(ctx, activeID))
	remaining, err := repo.FindAll(ctx)
	require.NoError(t, err)
	require.Len(t, remaining, 1)
	assert.Equal(t, inactiveID, remaining[0].ID())

	// 重复删除已不存在的记录 → ErrNotFound
	assert.ErrorIs(t, repo.Delete(ctx, activeID), domainannouncement.ErrNotFound)
}

func TestAnnouncementRepository_FindByID_NotFound(t *testing.T) {
	db := setupContentTestDB(t)
	repo := NewAnnouncementRepository(db)
	_, err := repo.FindByID(context.Background(), 999999)
	assert.ErrorIs(t, err, domainannouncement.ErrNotFound)
}

// ============================================================
// ProjectRepository 集成测试
// ============================================================

func TestProjectRepository_Lifecycle(t *testing.T) {
	db := setupContentTestDB(t)
	repo := NewProjectRepository(db)
	ctx := context.Background()

	// Save（新建）
	p, err := domainproject.NewProject(domainshared.NewID(), "violet", "博客系统")
	require.NoError(t, err)
	p.SetSortOrder(10)
	p.SetTechStack([]string{"go", "react"})
	require.NoError(t, repo.Save(ctx, p))

	// 第二个项目，sort_order 更小，用于验证 FindAll 排序
	p2, err := domainproject.NewProject(domainshared.NewID(), "iris", "TUI 客户端")
	require.NoError(t, err)
	p2.SetSortOrder(1)
	require.NoError(t, repo.Save(ctx, p2))

	// FindByID
	got, err := repo.FindByID(ctx, p.ID())
	require.NoError(t, err)
	assert.Equal(t, "violet", got.Title())
	assert.Equal(t, "博客系统", got.Description())
	assert.Equal(t, []string{"go", "react"}, got.TechStack())
	assert.Equal(t, 10, got.SortOrder())

	// FindAll：按 sort_order ASC → iris(1) 在前，violet(10) 在后
	all, err := repo.FindAll(ctx)
	require.NoError(t, err)
	require.Len(t, all, 2)
	assert.Equal(t, "iris", all[0].Title(), "sort_order 更小者应排在前面")
	assert.Equal(t, "violet", all[1].Title())

	// Delete
	require.NoError(t, repo.Delete(ctx, p.ID()))
	_, err = repo.FindByID(ctx, p.ID())
	assert.ErrorIs(t, err, domainproject.ErrNotFound)

	// 重复删除已不存在的记录 → ErrNotFound
	assert.ErrorIs(t, repo.Delete(ctx, p.ID()), domainproject.ErrNotFound)
}

func TestProjectRepository_FindByID_NotFound(t *testing.T) {
	db := setupContentTestDB(t)
	repo := NewProjectRepository(db)
	_, err := repo.FindByID(context.Background(), domainshared.NewID())
	assert.ErrorIs(t, err, domainproject.ErrNotFound)
}
