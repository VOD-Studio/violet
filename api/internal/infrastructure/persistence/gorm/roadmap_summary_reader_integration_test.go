package gorm

import (
	"context"
	"fmt"
	"testing"
	"time"

	domain "blog-api/internal/domain/roadmap"
	"blog-api/internal/domain/shared"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestRoadmapSummaryReaderIntegrationBatchCountsAndPreviews(t *testing.T) {
	db := setupIntegrationDB(t)
	repo := NewRoadmapRepository(db)
	ctx := context.Background()
	projectID, plannedOnlyID := seedRoadmapProject(t, db), seedRoadmapProject(t, db)
	emptyID, deletedOnlyID := seedRoadmapProject(t, db), seedRoadmapProject(t, db)
	otherID := seedRoadmapProject(t, db)
	date := time.Date(2026, 10, 18, 0, 0, 0, 0, time.UTC)
	seed := func(pid shared.ID, number int64, stage domain.Stage, position string, completedAt *time.Time, deleted bool) shared.ID {
		t.Helper()
		item, err := domain.NewItem(shared.NewID(), pid, number,
			domain.Content{Title: fmt.Sprintf("Item %d", number), CompletionDate: completedAt}, stage, position, date)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, item))
		if deleted {
			require.NoError(t, db.Exec("UPDATE roadmap_items SET deleted_at = NOW() WHERE id = ?", item.ID().UUID()).Error)
		}
		return item.ID()
	}
	seed(projectID, 1, domain.Planned, "V", nil, false)
	seed(projectID, 2, domain.InProgress, "a", nil, false)
	firstID := seed(projectID, 3, domain.InProgress, "Z", nil, false)
	secondID := seed(projectID, 4, domain.InProgress, "Z", nil, false)
	seed(projectID, 5, domain.InProgress, "b", nil, false)
	yesterday := date.AddDate(0, 0, -1)
	seed(projectID, 6, domain.Completed, "a", &yesterday, false)
	seed(projectID, 7, domain.Completed, "Z", &date, false)
	latestID := seed(projectID, 8, domain.Completed, "V", &date, false)
	tomorrow := date.AddDate(0, 0, 1)
	seed(projectID, 9, domain.Completed, "z", &tomorrow, true)
	seed(projectID, 10, domain.InProgress, "1", nil, true)
	seed(plannedOnlyID, 1, domain.Planned, "V", nil, false)
	seed(deletedOnlyID, 1, domain.Completed, "V", &date, true)
	seed(otherID, 1, domain.Completed, "V", &tomorrow, false)

	queries := 0
	count := func(*gorm.DB) { queries++ }
	require.NoError(t, db.Callback().Row().Before("gorm:row").Register("test:roadmap_summary_rows", count))
	require.NoError(t, db.Callback().Query().Before("gorm:query").Register("test:roadmap_summary_queries", count))
	ids := []shared.ID{projectID, plannedOnlyID, emptyID, deletedOnlyID}
	summaries, err := NewRoadmapSummaryReader(db).ReadSummaries(ctx, ids)
	require.NoError(t, err)
	assert.Equal(t, 1, queries, "项目数量不增加摘要查询次数，计数与预览使用同一语句快照")
	require.Len(t, summaries, len(ids))
	assert.NotContains(t, summaries, otherID)
	summary := summaries[projectID]
	assert.Equal(t, domain.ProgressCounts{Planned: 1, InProgress: 4, Completed: 3, Total: 8}, summary.Counts)
	require.Len(t, summary.InProgress, 2)
	assert.Equal(t, firstID, summary.InProgress[0].ID, "位置按字节序排列，Z 在 a 之前")
	assert.Equal(t, secondID, summary.InProgress[1].ID, "位置相同按编号升序")
	assert.Nil(t, summary.InProgress[0].CompletionDate)
	require.NotNil(t, summary.LatestCompleted)
	assert.Equal(t, latestID, summary.LatestCompleted.ID, "同日选编号更大的已完成条目")
	require.NotNil(t, summary.LatestCompleted.CompletionDate)
	assert.Equal(t, "2026-10-18", summary.LatestCompleted.CompletionDate.Format(time.DateOnly))
	assert.Equal(t, domain.ProgressCounts{Planned: 1, Total: 1}, summaries[plannedOnlyID].Counts)
	assert.Empty(t, summaries[plannedOnlyID].InProgress)
	assert.Nil(t, summaries[plannedOnlyID].LatestCompleted)
	for _, id := range []shared.ID{emptyID, deletedOnlyID} {
		assert.Equal(t, domain.ProgressCounts{}, summaries[id].Counts)
		assert.NotNil(t, summaries[id].InProgress)
		assert.Empty(t, summaries[id].InProgress)
		assert.Nil(t, summaries[id].LatestCompleted)
	}
}
