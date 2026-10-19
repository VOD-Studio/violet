package gorm

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainshared "blog-api/internal/domain/shared"
)

func TestRoadmapRelationsMigrationIntegration_RoundTrip(t *testing.T) {
	db, migration := setupRoadmapMigrationTest(t, 136)
	projectID, otherID := domainshared.NewID(), domainshared.NewID()
	firstID, secondID, foreignID := domainshared.NewID(), domainshared.NewID(), domainshared.NewID()
	require.NoError(t, db.Exec("INSERT INTO projects(id,title,slug) VALUES (?, 'First', 'first'), (?, 'Other', 'other')", projectID.UUID(), otherID.UUID()).Error)
	for i, id := range []domainshared.ID{firstID, secondID, foreignID} {
		owner := projectID
		if id.Equal(foreignID) {
			owner = otherID
		}
		require.NoError(t, db.Exec("INSERT INTO roadmap_items(id,project_id,number,title,stage,position) VALUES (?, ?, ?, 'Item', 'planned', 'V')", id.UUID(), owner.UUID(), i+1).Error)
	}
	require.NoError(t, migration.Steps(1))
	insert := "INSERT INTO roadmap_relations(id,project_id,source_id,target_id,type) VALUES (?, ?, ?, ?, ?)"
	require.NoError(t, db.Exec(insert, domainshared.NewID().UUID(), projectID.UUID(), firstID.UUID(), secondID.UUID(), "blocks").Error)
	assert.Error(t, db.Exec(insert, domainshared.NewID().UUID(), projectID.UUID(), firstID.UUID(), secondID.UUID(), "blocks").Error)
	assert.Error(t, db.Exec(insert, domainshared.NewID().UUID(), projectID.UUID(), firstID.UUID(), firstID.UUID(), "blocks").Error)
	assert.Error(t, db.Exec(insert, domainshared.NewID().UUID(), projectID.UUID(), firstID.UUID(), secondID.UUID(), "unknown").Error)
	assert.Error(t, db.Exec(insert, domainshared.NewID().UUID(), projectID.UUID(), firstID.UUID(), foreignID.UUID(), "blocks").Error)
	require.NoError(t, db.Exec(insert, domainshared.NewID().UUID(), projectID.UUID(), firstID.UUID(), secondID.UUID(), "fixes").Error)

	require.NoError(t, migration.Steps(-1))
	assert.False(t, db.Migrator().HasTable("roadmap_relations"))
	assert.True(t, db.Migrator().HasTable("roadmap_items"))
	var count int64
	require.NoError(t, db.Table("roadmap_items").Count(&count).Error)
	assert.Equal(t, int64(3), count)
	require.NoError(t, migration.Steps(1))
	require.NoError(t, db.Exec(insert, domainshared.NewID().UUID(), projectID.UUID(), firstID.UUID(), secondID.UUID(), "blocks").Error)
}
