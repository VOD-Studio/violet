package roadmap

import (
	"errors"
	"testing"
	"time"

	domain "blog-api/internal/domain/roadmap"
	"blog-api/internal/domain/shared"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestServiceMoveOnlyChangesOneItemAndDoesNotAuditReorder(t *testing.T) {
	svc, repo, bus, ctx := testService(t)
	created := make([]ItemDTO, 0, 3)
	for _, title := range []string{"A", "B", "C"} {
		item, err := svc.Create(ctx, repo.project.String(), CreateInput{Title: title})
		require.NoError(t, err)
		created = append(created, item)
	}
	repo.saveIDs = nil
	bus.events = nil
	moved, err := svc.Move(ctx, repo.project.String(), created[2].ID,
		MoveInput{Stage: "planned", BeforeID: created[0].ID, AfterID: created[1].ID})
	require.NoError(t, err)
	assert.Greater(t, moved.Position, created[0].Position)
	assert.Less(t, moved.Position, created[1].Position)
	assert.Equal(t, created[2].Number, moved.Number)
	assert.Equal(t, []shared.ID{shared.MustParseID(created[2].ID)}, repo.saveIDs)
	assert.Empty(t, bus.events)
	for _, unchanged := range created[:2] {
		item := repo.items[shared.MustParseID(unchanged.ID)]
		assert.Equal(t, unchanged.Position, item.Position())
		assert.Equal(t, unchanged.UpdatedAt, item.UpdatedAt().Format(time.RFC3339))
	}
}

func TestServiceMoveUsesOnlyCurrentAdjacentNeighbors(t *testing.T) {
	for _, tc := range []struct {
		name          string
		before, after int
		fallback      bool
	}{
		{"between adjacent", 0, 1, false},
		{"before first", -1, 0, false},
		{"after last", 2, -1, false},
		{"missing neighbors", -1, -1, true},
		{"no longer adjacent", 0, 2, true},
		{"same neighbor twice", 1, 1, true},
		{"wrong boundary before", 0, -1, true},
		{"wrong boundary after", -1, 1, true},
		{"deleted neighbor", 3, 2, true},
		{"moved neighbor", 4, 2, true},
		{"cross project neighbor", 5, 2, true},
		{"unknown neighbor", 6, 2, true},
		{"self neighbor", 7, 2, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			svc, repo, _, ctx := testService(t)
			targets := make([]ItemDTO, 0, 3)
			for _, title := range []string{"A", "B", "C"} {
				item, err := svc.Create(ctx, repo.project.String(), CreateInput{Title: title})
				require.NoError(t, err)
				targets = append(targets, item)
			}
			mover, err := svc.Create(ctx, repo.project.String(), CreateInput{Title: "Move", Stage: "in_progress"})
			require.NoError(t, err)
			deletedAt := svc.now()
			deletedID, movedID, otherID := shared.NewID(), shared.NewID(), shared.NewID()
			for _, state := range []domain.ItemState{
				{ID: deletedID, ProjectID: repo.project, Number: 10, Content: domain.Content{Title: "Deleted"},
					Stage: domain.Planned, Position: "z", DeletedAt: &deletedAt},
				{ID: movedID, ProjectID: repo.project, Number: 11, Content: domain.Content{Title: "Moved"},
					Stage: domain.InProgress, Position: "z"},
				{ID: otherID, ProjectID: shared.NewID(), Number: 1, Content: domain.Content{Title: "Other project"},
					Stage: domain.Planned, Position: "z"},
			} {
				repo.items[state.ID] = domain.ReconstructItem(state)
			}
			ids := []string{targets[0].ID, targets[1].ID, targets[2].ID, deletedID.String(), movedID.String(),
				otherID.String(), shared.NewID().String(), mover.ID}
			beforeID, afterID := "", ""
			if tc.before >= 0 {
				beforeID = ids[tc.before]
			}
			if tc.after >= 0 {
				afterID = ids[tc.after]
			}
			moved, err := svc.Move(ctx, repo.project.String(), mover.ID,
				MoveInput{Stage: "planned", BeforeID: beforeID, AfterID: afterID})
			require.NoError(t, err)
			if tc.fallback || tc.after == -1 {
				assert.Greater(t, moved.Position, targets[2].Position)
			} else {
				assert.Less(t, moved.Position, targets[tc.after].Position)
				if tc.before >= 0 {
					assert.Greater(t, moved.Position, targets[tc.before].Position)
				}
			}
		})
	}
}

func TestServiceMoveStageRulesReturnReconciledFields(t *testing.T) {
	svc, repo, bus, ctx := testService(t)
	item, err := svc.Create(ctx, repo.project.String(), CreateInput{Title: "Lifecycle"})
	require.NoError(t, err)
	bus.events = nil
	completed, err := svc.Move(ctx, repo.project.String(), item.ID, MoveInput{Stage: "completed", DeliveredVersion: "v1"})
	require.NoError(t, err)
	assert.Equal(t, "2026-10-19", *completed.CompletionDate)
	assert.Equal(t, "v1", completed.DeliveredVersion)
	require.Len(t, bus.events, 1)
	change := bus.events[0].(domain.ItemStageChanged)
	assert.Equal(t, domain.Planned, change.From)
	assert.Equal(t, domain.Completed, change.To)
	beforeSaveCount := len(repo.saveIDs)
	_, err = svc.Move(ctx, repo.project.String(), item.ID, MoveInput{Stage: "completed"})
	require.Error(t, err)
	assert.Len(t, repo.saveIDs, beforeSaveCount)
	assert.Len(t, bus.events, 1)
	left, err := svc.Move(ctx, repo.project.String(), item.ID, MoveInput{Stage: "in_progress",
		CompletionDate: completed.CompletionDate, DeliveredVersion: completed.DeliveredVersion})
	require.NoError(t, err)
	assert.Nil(t, left.CompletionDate)
	assert.Empty(t, left.DeliveredVersion)
	svc.now = func() time.Time { return time.Date(2026, 10, 21, 1, 0, 0, 0, time.UTC) }
	again, err := svc.Move(ctx, repo.project.String(), item.ID, MoveInput{Stage: "completed"})
	require.NoError(t, err)
	assert.Equal(t, "2026-10-21", *again.CompletionDate)
	explicit := "2026-10-01"
	_, err = svc.Move(ctx, repo.project.String(), item.ID, MoveInput{Stage: "planned"})
	require.NoError(t, err)
	again, err = svc.Move(ctx, repo.project.String(), item.ID,
		MoveInput{Stage: "completed", CompletionDate: &explicit, DeliveredVersion: "patch"})
	require.NoError(t, err)
	assert.Equal(t, explicit, *again.CompletionDate)
	assert.Equal(t, "patch", again.DeliveredVersion)
}

func TestServiceMoveRejectsUnauthorizedAndRolledBackChanges(t *testing.T) {
	svc, repo, bus, ctx := testService(t)
	item, err := svc.Create(ctx, repo.project.String(), CreateInput{Title: "Original"})
	require.NoError(t, err)
	bus.events = nil
	repo.saveErr = errors.New("unavailable")
	_, err = svc.Move(ctx, repo.project.String(), item.ID, MoveInput{Stage: "completed"})
	require.Error(t, err)
	assert.Empty(t, bus.events)
	assert.Equal(t, domain.Planned, repo.items[shared.MustParseID(item.ID)].Stage())
	svc.checker = &testChecker{}
	_, err = svc.Move(ctx, repo.project.String(), item.ID, MoveInput{Stage: "in_progress"})
	assert.True(t, shared.IsDomainError(err, shared.CodeForbidden))
}
