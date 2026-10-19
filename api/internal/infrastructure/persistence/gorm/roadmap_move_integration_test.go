package gorm

import (
	"context"
	"testing"

	approadmap "blog-api/internal/application/roadmap"
	appshared "blog-api/internal/application/shared"
	"blog-api/internal/domain/shared"
	"blog-api/internal/middleware"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type roadmapMoveAllowChecker struct{}

func (roadmapMoveAllowChecker) HasPermission(string, bool, ...string) bool { return true }

func TestRoadmapRepositoryIntegrationMoveUpdatesOnlyOneRow(t *testing.T) {
	db := setupIntegrationDB(t)
	pid := seedRoadmapProject(t, db)
	svc := approadmap.NewService(NewRoadmapRepository(db), NewProjectRepository(db), roadmapMoveAllowChecker{}, appshared.NoopEventBus{})
	ctx := context.WithValue(context.Background(), middleware.UserIDKey, shared.NewID().String())
	items := make([]approadmap.ItemDTO, 0, 3)
	for _, title := range []string{"A", "B", "C"} {
		item, err := svc.Create(ctx, pid.String(), approadmap.CreateInput{Title: title})
		require.NoError(t, err)
		items = append(items, item)
	}
	require.NoError(t, db.Exec(`CREATE TABLE roadmap_move_updates (item_id UUID NOT NULL);
		CREATE FUNCTION record_roadmap_move_update() RETURNS TRIGGER AS $$
		BEGIN INSERT INTO roadmap_move_updates (item_id) VALUES (NEW.id); RETURN NEW; END;
		$$ LANGUAGE plpgsql;
		CREATE TRIGGER record_roadmap_move_update AFTER UPDATE ON roadmap_items
		FOR EACH ROW EXECUTE FUNCTION record_roadmap_move_update()`).Error)
	moved, err := svc.Move(ctx, pid.String(), items[2].ID,
		approadmap.MoveInput{Stage: "planned", BeforeID: items[0].ID, AfterID: items[1].ID})
	require.NoError(t, err)
	assert.Greater(t, moved.Position, items[0].Position)
	assert.Less(t, moved.Position, items[1].Position)
	var updated []string
	require.NoError(t, db.Table("roadmap_move_updates").Pluck("item_id", &updated).Error)
	assert.Equal(t, []string{items[2].ID}, updated, "重排只能 UPDATE 被移动的那一行")
	stored, err := NewRoadmapRepository(db).FindByID(ctx, shared.MustParseID(moved.ID), false)
	require.NoError(t, err)
	assert.Equal(t, moved.Position, stored.Position())
	assert.Equal(t, items[2].Number, stored.Number())
}
