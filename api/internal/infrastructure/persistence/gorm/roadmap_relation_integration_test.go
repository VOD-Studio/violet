package gorm

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	domain "blog-api/internal/domain/roadmap"
	"blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

func seedRelationProject(t *testing.T, db *gorm.DB) shared.ID {
	t.Helper()
	id := shared.NewID()
	require.NoError(t, db.Exec("INSERT INTO projects (id, title, slug) VALUES (?, '路线图关系测试', ?)",
		id.UUID(), "relation-"+id.String()).Error)
	return id
}

func seedRelationItem(t *testing.T, db *gorm.DB, projectID shared.ID, number int64) *domain.Item {
	t.Helper()
	item, err := domain.NewItem(shared.NewID(), projectID, number, domain.Content{Title: "条目"}, domain.Planned, "U", time.Now())
	require.NoError(t, err)
	require.NoError(t, NewRoadmapRepository(db).Save(context.Background(), item))
	return item
}

func seedRelation(t *testing.T, repo *RoadmapRelationRepository, projectID, sourceID, targetID shared.ID, kind domain.RelationType) *domain.Relation {
	t.Helper()
	relation, err := domain.NewRelation(shared.NewID(), projectID, sourceID, targetID, kind, time.Now())
	require.NoError(t, err)
	require.NoError(t, repo.Create(context.Background(), relation))
	return relation
}

func TestRoadmapRelationDatabaseConstraints(t *testing.T) {
	db := setupIntegrationDB(t)
	projectID, otherProjectID := seedRelationProject(t, db), seedRelationProject(t, db)
	a, b := seedRelationItem(t, db, projectID, 1), seedRelationItem(t, db, projectID, 2)
	other := seedRelationItem(t, db, otherProjectID, 1)
	repo := NewRoadmapRelationRepository(db)
	seedRelation(t, repo, projectID, a.ID(), b.ID(), domain.RelationBlocks)
	for _, test := range []struct {
		name   string
		source uuid.UUID
		target uuid.UUID
		kind   string
	}{
		{name: "duplicate", source: a.ID().UUID(), target: b.ID().UUID(), kind: "blocks"},
		{name: "self", source: a.ID().UUID(), target: a.ID().UUID(), kind: "fixes"},
		{name: "unknown type", source: a.ID().UUID(), target: b.ID().UUID(), kind: "related"},
		{name: "cross project source", source: other.ID().UUID(), target: b.ID().UUID(), kind: "extends"},
		{name: "cross project target", source: a.ID().UUID(), target: other.ID().UUID(), kind: "extends"},
	} {
		t.Run(test.name, func(t *testing.T) {
			err := db.Create(&model.RoadmapRelation{ID: uuid.New(), ProjectID: projectID.UUID(),
				SourceID: test.source, TargetID: test.target, Type: test.kind, CreatedAt: time.Now()}).Error
			require.Error(t, err)
		})
	}
	seedRelation(t, repo, projectID, a.ID(), b.ID(), domain.RelationExtends)
	items, err := repo.FindByProject(context.Background(), projectID, false)
	require.NoError(t, err)
	assert.Len(t, items, 2)
}

func TestRoadmapRelationSoftDeleteHidesWithoutRemoving(t *testing.T) {
	db := setupIntegrationDB(t)
	ctx := context.Background()
	projectID := seedRelationProject(t, db)
	a, b := seedRelationItem(t, db, projectID, 1), seedRelationItem(t, db, projectID, 2)
	repo := NewRoadmapRelationRepository(db)
	relation := seedRelation(t, repo, projectID, a.ID(), b.ID(), domain.RelationBlocks)
	for _, endpoint := range []shared.ID{a.ID(), b.ID()} {
		require.NoError(t, db.Exec("UPDATE roadmap_items SET deleted_at = NOW() WHERE id = ?", endpoint.UUID()).Error)
		visible, err := repo.FindByProject(ctx, projectID, false)
		require.NoError(t, err)
		assert.Empty(t, visible)
		hidden, err := repo.FindByProject(ctx, projectID, true)
		require.NoError(t, err)
		require.Len(t, hidden, 1)
		assert.Equal(t, relation.ID(), hidden[0].ID())
		require.NoError(t, db.Exec("UPDATE roadmap_items SET deleted_at = NULL WHERE id = ?", endpoint.UUID()).Error)
		visible, err = repo.FindByProject(ctx, projectID, false)
		require.NoError(t, err)
		require.Len(t, visible, 1)
		assert.Equal(t, relation.ID(), visible[0].ID())
	}
	require.NoError(t, repo.Delete(ctx, projectID, relation.ID()))
	require.NoError(t, db.Exec("UPDATE roadmap_items SET deleted_at = NOW() WHERE id = ?", a.ID().UUID()).Error)
	require.NoError(t, db.Exec("UPDATE roadmap_items SET deleted_at = NULL WHERE id = ?", a.ID().UUID()).Error)
	visible, err := repo.FindByProject(ctx, projectID, false)
	require.NoError(t, err)
	assert.Empty(t, visible)
}
