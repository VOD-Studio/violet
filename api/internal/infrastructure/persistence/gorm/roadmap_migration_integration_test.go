package gorm

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainshared "blog-api/internal/domain/shared"
)

func TestRoadmapItemsMigrationIntegration_RoundTrip(t *testing.T) {
	db, migration := setupRoadmapMigrationTest(t, 135)
	projectID, itemID := domainshared.NewID(), domainshared.NewID()
	require.NoError(t, db.Exec("INSERT INTO projects(id,title,slug) VALUES (?, 'Migration', 'migration')", projectID.UUID()).Error)
	require.NoError(t, migration.Steps(1))
	insert := "INSERT INTO roadmap_items(id,project_id,number,title,stage,position) VALUES (?, ?, 1, 'Item', 'planned', 'V')"
	require.NoError(t, db.Exec(insert, itemID.UUID(), projectID.UUID()).Error)
	require.NoError(t, db.Exec("INSERT INTO roadmap_item_counters(project_id,last_number) VALUES (?,1)", projectID.UUID()).Error)
	assert.Error(t, db.Exec("UPDATE roadmap_items SET stage='completed' WHERE id=?", itemID.UUID()).Error)
	assert.Error(t, db.Exec("UPDATE roadmap_items SET delivered_version='v1' WHERE id=?", itemID.UUID()).Error)
	assert.Error(t, db.Exec("UPDATE roadmap_items SET title='   ' WHERE id=?", itemID.UUID()).Error)
	assert.Error(t, db.Exec("UPDATE roadmap_items SET tags='{}'::jsonb WHERE id=?", itemID.UUID()).Error)
	require.NoError(t, db.Exec("UPDATE roadmap_items SET stage='completed', completion_date='2026-10-18', delivered_version='v1' WHERE id=?", itemID.UUID()).Error)

	require.NoError(t, migration.Steps(-1))
	assert.False(t, db.Migrator().HasTable("roadmap_items"))
	assert.False(t, db.Migrator().HasTable("roadmap_item_counters"))
	var title string
	require.NoError(t, db.Raw("SELECT title FROM projects WHERE id=?", projectID.UUID()).Scan(&title).Error)
	assert.Equal(t, "Migration", title)
	require.NoError(t, migration.Steps(1))
	require.NoError(t, db.Exec(insert, itemID.UUID(), projectID.UUID()).Error)
}
