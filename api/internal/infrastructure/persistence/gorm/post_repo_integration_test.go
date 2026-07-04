package gorm

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"blog-api/internal/domain/post"
	domainshared "blog-api/internal/domain/shared"
)

// 这批集成测试连真实 PostgreSQL 并执行真实 migration 文件，
// 用于锁住「migration SQL 与 GORM 模型字段映射必须一致」这一不变量。
//
// 现有 SQLite + AutoMigrate 测试套件无法发现这类漂移：
// AutoMigrate 按模型字段名建表，永远不会暴露 migration 里列名与模型 column tag 的不一致。
//
// 运行方式（需本机或 Docker 内可达的 PostgreSQL）：
//
//	BLOG_TEST_PG_DSN="postgres://user:pass@localhost:5432/blog_test?sslmode=disable" go test ./internal/infrastructure/persistence/gorm/ -run TestPostRepositoryIntegration -v
//
// 未设置 BLOG_TEST_PG_DSN 时整体 skip，保持 `make api-test` 零外部依赖。

const testPgDSNEnv = "BLOG_TEST_PG_DSN"

func pgDSNFromEnv(t *testing.T) string {
	t.Helper()
	dsn := os.Getenv(testPgDSNEnv)
	if dsn == "" {
		t.Skipf("未设置 %s，跳过 PostgreSQL 集成测试", testPgDSNEnv)
	}
	return dsn
}

// toMigrateDSN 将 postgres:// 转为 golang-migrate 的 pgx5:// 前缀。
func toMigrateDSN(dsn string) string {
	if len(dsn) >= len("postgres://") && dsn[:len("postgres://")] == "postgres://" {
		return "pgx5://" + dsn[len("postgres://"):]
	}
	return dsn
}

// migrationsAbsDir 解析仓库 api/migrations 目录的 file:// 绝对路径。
func migrationsAbsDir(t *testing.T) string {
	t.Helper()
	wd, err := os.Getwd()
	require.NoError(t, err)
	// 测试位于 internal/infrastructure/persistence/gorm/，回退 4 层到 api/。
	apiDir := filepath.Join(wd, "..", "..", "..", "..")
	abs, err := filepath.Abs(filepath.Join(apiDir, "migrations"))
	require.NoError(t, err)
	return "file://" + abs
}

// setupIntegrationDB 建立到 PostgreSQL 的连接并确保 migration 已执行到最新。
func setupIntegrationDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := pgDSNFromEnv(t)

	m, err := migrate.New(migrationsAbsDir(t), toMigrateDSN(dsn))
	require.NoError(t, err)
	defer m.Close()
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		require.NoErrorf(t, err, "执行 migration 失败")
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	// 每个测试结束时清理本次写入的版本与文章数据，避免数据累积污染后续用例。
	t.Cleanup(func() {
		_ = db.Exec("DELETE FROM post_versions").Error
		_ = db.Exec("DELETE FROM posts").Error
		_ = db.Exec("DELETE FROM tags").Error
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
	})
	return db
}

func preseedAuthor(t *testing.T, db *gorm.DB) domainshared.ID {
	t.Helper()
	authorID := domainshared.NewID()
	require.NoError(t, db.Exec(
		`INSERT INTO users (id, username, email, password_hash, role, is_active, created_at, updated_at)
		 VALUES (?, ?, ?, 'x', 'user', true, NOW(), NOW())`,
		authorID.UUID(),
		fmt.Sprintf("author-%s", authorID.UUID()),
		fmt.Sprintf("author-%s@test", authorID.UUID()),
	).Error)
	return authorID
}

// TestPostRepositoryIntegration_SaveVersion 锁住 issue：GORM 模型对 post_versions.tags_snapshot
// 列的映射缺失，导致 SaveVersion 写入不存在的 tags 列（SQLSTATE 42703）。
func TestPostRepositoryIntegration_SaveVersion(t *testing.T) {
	db := setupIntegrationDB(t)
	repo := NewPostRepository(db)

	authorID := preseedAuthor(t, db)
	pid := domainshared.NewID()
	p, err := post.NewPost(pid, authorID, "Versioned Title", "slug-versioned")
	require.NoError(t, err)
	p.SetTags([]string{})
	require.NoError(t, repo.Save(context.Background(), p))

	version := post.NewPostVersion(p, authorID, "首次快照")
	require.NoError(t, repo.SaveVersion(context.Background(), version))

	var snapColumn string
	require.NoError(t, db.Raw(
		`SELECT column_name FROM information_schema.columns WHERE table_name = 'post_versions' AND column_name = 'tags_snapshot'`,
	).Scan(&snapColumn).Error)
	assert.Equal(t, "tags_snapshot", snapColumn, "post_versions 应有 tags_snapshot 列")

	loaded, err := repo.GetVersionByID(context.Background(), version.ID())
	require.NoError(t, err)
	assert.Equal(t, version.Title(), loaded.Title())
	assert.Empty(t, loaded.Tags())

	// 二次验证：带 tags 的快照也能正确写回 JSONB。
	p.SetTags([]string{"go", "web"})
	version2 := post.NewPostVersion(p, authorID, "带标签快照")
	require.NoError(t, repo.SaveVersion(context.Background(), version2))
	loaded2, err := repo.GetVersionByID(context.Background(), version2.ID())
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{"go", "web"}, loaded2.Tags())
}
