package gorm

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	domainapitoken "blog-api/internal/domain/api_token"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

func setupTokenTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	tmpFile := filepath.Join(t.TempDir(), "test.db")
	db, err := gorm.Open(sqlite.Open(tmpFile), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.APIToken{}))
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func TestAPITokenRepository_SaveAndFindByHash(t *testing.T) {
	db := setupTokenTestDB(t)
	repo := NewAPITokenRepository(db)
	ctx := context.Background()
	now := time.Date(2026, 7, 27, 12, 0, 0, 0, time.UTC)

	p, plaintext, err := domainapitoken.NewPAT("u-1", "测试令牌",
		[]string{domainapitoken.ScopePostsRead, domainapitoken.ScopePostsWrite}, 90*24*time.Hour, now)
	require.NoError(t, err)
	require.NoError(t, repo.Save(ctx, p))

	// 按哈希查回（FindByHash 接收哈希，不是明文）
	got, err := repo.FindByHash(ctx, domainapitoken.HashToken(plaintext))
	require.NoError(t, err)
	assert.Equal(t, p.ID(), got.ID())
	assert.Equal(t, "u-1", got.UserID())
	assert.Equal(t, "测试令牌", got.Name())
	assert.Equal(t, []string{domainapitoken.ScopePostsRead, domainapitoken.ScopePostsWrite}, got.Scopes())
	assert.False(t, got.ExpiresAt().IsZero(), "90 天 TTL → expires_at 非零")
}

func TestAPITokenRepository_FindByHash_NotFound(t *testing.T) {
	db := setupTokenTestDB(t)
	repo := NewAPITokenRepository(db)
	_, err := repo.FindByHash(context.Background(), "nonexistent-hash")
	assert.ErrorIs(t, err, domainapitoken.ErrNotFound)
}

func TestAPITokenRepository_NeverExpires_Roundtrip(t *testing.T) {
	db := setupTokenTestDB(t)
	repo := NewAPITokenRepository(db)
	now := time.Now()

	p, pt, _ := domainapitoken.NewPAT("u-1", "永久", []string{domainapitoken.ScopePostsRead}, 0, now)
	require.NoError(t, repo.Save(context.Background(), p))

	got, _ := repo.FindByHash(context.Background(), domainapitoken.HashToken(pt))
	assert.True(t, got.ExpiresAt().IsZero(), "永不过期：DB NULL → 零值 time")
}

func TestAPITokenRepository_FindByUser(t *testing.T) {
	db := setupTokenTestDB(t)
	repo := NewAPITokenRepository(db)
	ctx := context.Background()
	now := time.Now()

	p1, _, _ := domainapitoken.NewPAT("u-1", "令牌1", []string{domainapitoken.ScopePostsRead}, 0, now)
	p2, _, _ := domainapitoken.NewPAT("u-1", "令牌2", []string{domainapitoken.ScopePostsWrite}, 0, now)
	p3, _, _ := domainapitoken.NewPAT("u-2", "他人令牌", []string{domainapitoken.ScopePostsRead}, 0, now)
	require.NoError(t, repo.Save(ctx, p1))
	require.NoError(t, repo.Save(ctx, p2))
	require.NoError(t, repo.Save(ctx, p3))

	got, err := repo.FindByUser(ctx, "u-1")
	require.NoError(t, err)
	assert.Len(t, got, 2, "只返回 u-1 的令牌")
}

func TestAPITokenRepository_Delete(t *testing.T) {
	db := setupTokenTestDB(t)
	repo := NewAPITokenRepository(db)
	ctx := context.Background()
	now := time.Now()

	p, pt, _ := domainapitoken.NewPAT("u-1", "待删", []string{domainapitoken.ScopePostsRead}, 0, now)
	require.NoError(t, repo.Save(ctx, p))

	// 按 id+userID 删除
	require.NoError(t, repo.Delete(ctx, p.ID(), "u-1"))
	_, err := repo.FindByHash(ctx, domainapitoken.HashToken(pt))
	assert.ErrorIs(t, err, domainapitoken.ErrNotFound, "删除后查不到")
}

func TestAPITokenRepository_Delete_PreventsCrossUser(t *testing.T) {
	db := setupTokenTestDB(t)
	repo := NewAPITokenRepository(db)
	ctx := context.Background()
	now := time.Now()

	p, pt, _ := domainapitoken.NewPAT("u-1", "victim", []string{domainapitoken.ScopePostsRead}, 0, now)
	require.NoError(t, repo.Save(ctx, p))

	// u-2 试图删 u-1 的 token：不报错但不生效（DELETE 0 行）
	require.NoError(t, repo.Delete(ctx, p.ID(), "u-2"))
	got, err := repo.FindByHash(ctx, domainapitoken.HashToken(pt))
	require.NoError(t, err)
	assert.Equal(t, p.ID(), got.ID(), "跨用户删除不应生效")
}

func TestAPITokenRepository_TouchLastUsed(t *testing.T) {
	db := setupTokenTestDB(t)
	repo := NewAPITokenRepository(db)
	ctx := context.Background()
	now := time.Now()

	p, pt, _ := domainapitoken.NewPAT("u-1", "x", []string{domainapitoken.ScopePostsRead}, 0, now)
	require.NoError(t, repo.Save(ctx, p))
	assert.True(t, repo.FindByHashMust(t, domainapitoken.HashToken(pt)).LastUsedAt().IsZero(), "初始 last_used_at 为零值")

	used := now.Add(time.Hour)
	require.NoError(t, repo.TouchLastUsed(ctx, p.ID(), used))

	got := repo.FindByHashMust(t, domainapitoken.HashToken(pt))
	assert.True(t, got.LastUsedAt().Equal(used), "last_used_at 应更新为 used")
}

// FindByHashMust 测试辅助：FindByHash 失败即 fatal。
func (r *APITokenRepository) FindByHashMust(t *testing.T, hash string) *domainapitoken.PAT {
	t.Helper()
	p, err := r.FindByHash(context.Background(), hash)
	require.NoError(t, err)
	return p
}
