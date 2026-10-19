package gorm

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"testing"
	"time"

	domain "blog-api/internal/domain/roadmap"
	"blog-api/internal/domain/shared"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func seedRoadmapProject(t *testing.T, db *gorm.DB) shared.ID {
	t.Helper()
	id := shared.NewID()
	require.NoError(t, db.Exec("INSERT INTO projects (id, title, slug) VALUES (?, 'Roadmap integration', ?)",
		id.UUID(), "roadmap-"+id.String()).Error)
	return id
}

func TestRoadmapRepositoryIntegrationConcurrentCreation(t *testing.T) {
	db := setupIntegrationDB(t)
	pid := seedRoadmapProject(t, db)
	repo := NewRoadmapRepository(db)
	ctx := context.Background()
	const count = 24
	var wg sync.WaitGroup
	errors := make(chan error, count)
	for n := range count {
		wg.Go(func() {
			errors <- repo.WithinProject(ctx, pid, func(tx domain.Repository) error {
				number, err := tx.NextNumber(ctx, pid)
				if err != nil {
					return err
				}
				item, err := domain.NewItem(shared.NewID(), pid, number, domain.Content{Title: fmt.Sprintf("Concurrent %d", n)},
					domain.Planned, "V", time.Now())
				if err != nil {
					return err
				}
				return tx.Save(ctx, item)
			})
		})
	}
	wg.Wait()
	close(errors)
	for err := range errors {
		require.NoError(t, err)
	}
	items, err := repo.FindByProject(ctx, pid)
	require.NoError(t, err)
	require.Len(t, items, count)
	numbers := make([]int, 0, count)
	for _, item := range items {
		numbers = append(numbers, int(item.Number()))
	}
	sort.Ints(numbers)
	for n, number := range numbers {
		assert.Equal(t, n+1, number)
	}
	otherPID := seedRoadmapProject(t, db)
	number, err := repo.NextNumber(ctx, otherPID)
	require.NoError(t, err)
	assert.Equal(t, int64(1), number, "项目编号各自独立")
}

func TestRoadmapRepositoryIntegrationOrderingAndCounterRetention(t *testing.T) {
	db := setupIntegrationDB(t)
	pid := seedRoadmapProject(t, db)
	repo := NewRoadmapRepository(db)
	ctx := context.Background()
	date := time.Date(2026, 10, 18, 0, 0, 0, 0, time.UTC)
	for _, tc := range []struct {
		number   int64
		stage    domain.Stage
		position string
		date     time.Time
	}{{1, domain.Planned, "a", date}, {2, domain.Planned, "Z", date}, {3, domain.Completed, "z", date.AddDate(0, 0, -1)},
		{4, domain.Completed, "a", date}, {5, domain.Completed, "V", date}, {6, domain.InProgress, "V", date}} {
		content := domain.Content{Title: fmt.Sprintf("Item %d", tc.number)}
		if tc.stage == domain.Completed {
			content.CompletionDate = &tc.date
		}
		item, err := domain.NewItem(shared.NewID(), pid, tc.number, content, tc.stage, tc.position, time.Now())
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, item))
	}
	items, err := repo.FindByProject(ctx, pid)
	require.NoError(t, err)
	numbers := make([]int64, 0, len(items))
	for _, item := range items {
		numbers = append(numbers, item.Number())
	}
	assert.Equal(t, []int64{2, 1, 6, 5, 4, 3}, numbers, "手动顺序采用字节序，完成条目只按日期与编号倒序")

	require.NoError(t, db.Exec("INSERT INTO roadmap_item_counters (project_id, last_number) VALUES (?, 6)", pid.UUID()).Error)
	require.NoError(t, db.Exec("UPDATE roadmap_items SET deleted_at = NOW() WHERE project_id = ? AND number = 6", pid.UUID()).Error)
	number, err := repo.NextNumber(ctx, pid)
	require.NoError(t, err)
	assert.Equal(t, int64(7), number, "删除最大编号后不复用")
	active, err := repo.FindByProject(ctx, pid)
	require.NoError(t, err)
	assert.Len(t, active, 5)
	_, err = repo.FindByID(ctx, items[2].ID(), false)
	assert.ErrorIs(t, err, domain.ErrNotFound)
	deleted, err := repo.FindByID(ctx, items[2].ID(), true)
	require.NoError(t, err)
	assert.NotNil(t, deleted.DeletedAt())
}

func TestRoadmapRepositoryIntegrationChecklistRoundTrip(t *testing.T) {
	db := setupIntegrationDB(t)
	pid := seedRoadmapProject(t, db)
	repo := NewRoadmapRepository(db)
	ctx := context.Background()
	now := time.Now()
	item, err := domain.NewItem(shared.NewID(), pid, 1, domain.Content{Title: "Steps",
		Checklist: []domain.ChecklistItem{{Text: "design", Done: true}, {Text: "build"}}}, domain.Planned, "V", now)
	require.NoError(t, err)
	require.NoError(t, repo.Save(ctx, item))

	found, err := repo.FindByID(ctx, item.ID(), false)
	require.NoError(t, err)
	assert.Equal(t, []domain.ChecklistItem{{Text: "design", Done: true}, {Text: "build"}}, found.Checklist())

	require.NoError(t, found.UpdateContent(domain.Content{Title: "Steps",
		Checklist: []domain.ChecklistItem{{Text: "design", Done: true}, {Text: "build", Done: true}}}, now.Add(time.Minute)))
	require.NoError(t, repo.Save(ctx, found))
	items, err := repo.FindByProject(ctx, pid)
	require.NoError(t, err)
	require.Len(t, items, 1)
	assert.Equal(t, []domain.ChecklistItem{{Text: "design", Done: true}, {Text: "build", Done: true}}, items[0].Checklist())

	plain, err := domain.NewItem(shared.NewID(), pid, 2, domain.Content{Title: "Plain"}, domain.Planned, "W", now)
	require.NoError(t, err)
	require.NoError(t, repo.Save(ctx, plain))
	reloaded, err := repo.FindByID(ctx, plain.ID(), false)
	require.NoError(t, err)
	assert.NotNil(t, reloaded.Checklist())
	assert.Empty(t, reloaded.Checklist())
}
