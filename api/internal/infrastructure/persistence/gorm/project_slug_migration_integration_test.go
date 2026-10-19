package gorm

import (
	"fmt"
	"net/url"
	"strings"
	"testing"

	"github.com/golang-migrate/migrate/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	domainshared "blog-api/internal/domain/shared"
)

func setupRoadmapMigrationTest(t *testing.T, version uint) (*gorm.DB, *migrate.Migrate) {
	t.Helper()
	dsn := pgDSNFromEnv(t)
	admin, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	adminSQL, err := admin.DB()
	require.NoError(t, err)
	schema := "roadmap_migration_" + strings.ReplaceAll(domainshared.NewID().String(), "-", "")
	require.NoError(t, admin.Exec(`CREATE SCHEMA "`+schema+`"`).Error)
	t.Cleanup(func() {
		assert.NoError(t, admin.Exec(`DROP SCHEMA IF EXISTS "`+schema+`" CASCADE`).Error)
		assert.NoError(t, adminSQL.Close())
	})
	parsed, err := url.Parse(dsn)
	require.NoError(t, err)
	query := parsed.Query()
	query.Set("search_path", schema)
	parsed.RawQuery = query.Encode()
	m, err := migrate.New(migrationsAbsDir(t), toMigrateDSN(parsed.String()))
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = m.Close() })
	require.NoError(t, m.Migrate(version))
	db, err := gorm.Open(postgres.Open(parsed.String()), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { assert.NoError(t, sqlDB.Close()) })
	return db, m
}

func TestProjectSlugMigrationIntegration_RoundTrip(t *testing.T) {
	db, migration := setupRoadmapMigrationTest(t, 134)
	titles := []string{
		"Roadmap", "Roadmap", "Roadmap-2", "你好", "???", "Roadmap 2",
		"alpha---beta", "-leading-", "", strings.Repeat("long-title-", 12),
		"project-00000000-0000-4000-8000-000000000004",
	}
	for i, title := range titles {
		id := fmt.Sprintf("00000000-0000-4000-8000-%012d", i+1)
		require.NoError(t, db.Exec("INSERT INTO projects(id, title, created_at) VALUES (?, ?, '2026-10-18T00:00:00Z')", id, title).Error)
	}

	require.NoError(t, migration.Steps(1))
	type row struct{ ID, Title, Slug string }
	var first []row
	require.NoError(t, db.Table("projects").Order("id").Find(&first).Error)
	require.Len(t, first, len(titles))
	seen := make(map[string]bool, len(first))
	for _, project := range first {
		assert.Regexp(t, `^[a-z0-9]+(-[a-z0-9]+)*$`, project.Slug)
		assert.False(t, seen[project.Slug], "duplicate slug %q", project.Slug)
		seen[project.Slug] = true
	}
	assert.Equal(t, "roadmap", first[0].Slug)
	assert.Equal(t, "roadmap-2", first[2].Slug)
	assert.Contains(t, first[3].Slug, first[3].ID)
	assert.Contains(t, first[4].Slug, first[4].ID)

	assert.Error(t, db.Exec("UPDATE projects SET slug = 'Invalid Slug' WHERE id = ?", first[0].ID).Error)
	assert.Error(t, db.Exec("UPDATE projects SET slug = ? WHERE id = ?", first[0].Slug, first[1].ID).Error)
	assert.Error(t, db.Exec("UPDATE projects SET slug = NULL WHERE id = ?", first[0].ID).Error)

	require.NoError(t, migration.Steps(-1))
	assert.False(t, db.Migrator().HasColumn("projects", "slug"))
	var count int64
	require.NoError(t, db.Table("projects").Count(&count).Error)
	assert.Equal(t, int64(len(titles)), count)
	require.NoError(t, migration.Steps(1))
	var second []row
	require.NoError(t, db.Table("projects").Order("id").Find(&second).Error)
	assert.Equal(t, first, second, "reapplying the migration must generate the same slugs")
}
