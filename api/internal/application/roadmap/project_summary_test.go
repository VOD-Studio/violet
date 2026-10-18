package roadmap

import (
	"context"
	"errors"
	"testing"
	"time"

	appproject "blog-api/internal/application/project"
	domain "blog-api/internal/domain/roadmap"
	"blog-api/internal/domain/shared"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type summaryReaderStub struct {
	summaries map[shared.ID]domain.ProjectSummary
	ids       []shared.ID
	err       error
}

func (r *summaryReaderStub) ReadSummaries(_ context.Context, ids []shared.ID) (map[shared.ID]domain.ProjectSummary, error) {
	r.ids = ids
	return r.summaries, r.err
}

func TestProjectSummaryReaderMapsProgressAndPreviews(t *testing.T) {
	projectID, emptyID := shared.NewID(), shared.NewID()
	currentID, completedID := shared.NewID(), shared.NewID()
	date := time.Date(2026, 10, 18, 0, 0, 0, 0, time.UTC)
	stub := &summaryReaderStub{summaries: map[shared.ID]domain.ProjectSummary{
		projectID: {
			Counts:     domain.ProgressCounts{Planned: 1, InProgress: 1, Completed: 1, Total: 3},
			InProgress: []domain.ItemPreview{{ID: currentID, Number: 2, Title: "Developing"}},
			LatestCompleted: &domain.ItemPreview{ID: completedID, Number: 3,
				Title: "Delivered", CompletionDate: &date},
		},
	}}
	ids := []shared.ID{projectID, emptyID}
	summaries, err := NewProjectSummaryReader(stub).ReadSummaries(context.Background(), ids)
	require.NoError(t, err)
	assert.Equal(t, ids, stub.ids)
	require.Len(t, summaries, 2)
	summary := summaries[projectID]
	assert.Equal(t, appproject.RoadmapProgressDTO{Planned: 1, InProgress: 1, Completed: 1, Total: 3, Percent: 33}, summary.Progress)
	require.Len(t, summary.InProgress, 1)
	assert.Equal(t, currentID.String(), summary.InProgress[0].ID)
	assert.Equal(t, int64(2), summary.InProgress[0].Number)
	assert.Equal(t, "Developing", summary.InProgress[0].Title)
	assert.Nil(t, summary.InProgress[0].CompletionDate)
	require.NotNil(t, summary.LatestCompleted)
	assert.Equal(t, completedID.String(), summary.LatestCompleted.ID)
	require.NotNil(t, summary.LatestCompleted.CompletionDate)
	assert.Equal(t, "2026-10-18", *summary.LatestCompleted.CompletionDate)
	empty := summaries[emptyID]
	assert.Equal(t, appproject.RoadmapProgressDTO{}, empty.Progress)
	assert.NotNil(t, empty.InProgress)
	assert.Empty(t, empty.InProgress)
	assert.Nil(t, empty.LatestCompleted)
}

func TestProjectSummaryReaderRoundsPercent(t *testing.T) {
	for _, tc := range []struct{ completed, total, percent int }{
		{0, 0, 0}, {0, 3, 0}, {1, 3, 33}, {2, 3, 67}, {1, 8, 13}, {3, 3, 100},
	} {
		id := shared.NewID()
		stub := &summaryReaderStub{summaries: map[shared.ID]domain.ProjectSummary{
			id: {Counts: domain.ProgressCounts{Completed: tc.completed, Total: tc.total}},
		}}
		result, err := NewProjectSummaryReader(stub).ReadSummaries(context.Background(), []shared.ID{id})
		require.NoError(t, err)
		assert.Equal(t, tc.percent, result[id].Progress.Percent)
	}
}

func TestProjectSummaryReaderPropagatesQueryError(t *testing.T) {
	queryErr := errors.New("summary query unavailable")
	result, err := NewProjectSummaryReader(&summaryReaderStub{err: queryErr}).
		ReadSummaries(context.Background(), []shared.ID{shared.NewID()})
	assert.Nil(t, result)
	assert.ErrorIs(t, err, queryErr)
}
