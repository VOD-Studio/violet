package gorm

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainshared "blog-api/internal/domain/shared"
)

func TestRoadmapChecklistMigrationIntegration_RoundTrip(t *testing.T) {
	db, migration := setupRoadmapMigrationTest(t, 137)
	projectID, existingID, newID := domainshared.NewID(), domainshared.NewID(), domainshared.NewID()
	require.NoError(t, db.Exec("INSERT INTO projects(id,title,slug) VALUES (?, 'Checklist', 'checklist')", projectID.UUID()).Error)
	insert := "INSERT INTO roadmap_items(id,project_id,number,title,stage,position) VALUES (?, ?, ?, 'Item', 'planned', 'V')"
	require.NoError(t, db.Exec(insert, existingID.UUID(), projectID.UUID(), 1).Error)

	require.NoError(t, migration.Steps(1))
	var existing string
	require.NoError(t, db.Raw("SELECT checklist::text FROM roadmap_items WHERE id=?", existingID.UUID()).Scan(&existing).Error)
	assert.Equal(t, "[]", existing, "已有条目升级后没有子项")
	require.NoError(t, db.Exec(insert, newID.UUID(), projectID.UUID(), 2).Error)
	assert.Error(t, db.Exec("UPDATE roadmap_items SET checklist='{}'::jsonb WHERE id=?", newID.UUID()).Error)
	assert.Error(t, db.Exec("UPDATE roadmap_items SET checklist=NULL WHERE id=?", newID.UUID()).Error)
	require.NoError(t, db.Exec(`UPDATE roadmap_items SET checklist='[{"text":"a","done":true}]'::jsonb WHERE id=?`, newID.UUID()).Error)

	require.NoError(t, migration.Steps(-1))
	assert.False(t, db.Migrator().HasColumn("roadmap_items", "checklist"))
	var count int64
	require.NoError(t, db.Table("roadmap_items").Count(&count).Error)
	assert.Equal(t, int64(2), count, "回滚只删列，不丢条目")
	require.NoError(t, migration.Steps(1))
	assert.True(t, db.Migrator().HasColumn("roadmap_items", "checklist"))
}
