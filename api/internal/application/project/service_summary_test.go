package project

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	domain "blog-api/internal/domain/project"
	"blog-api/internal/domain/shared"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type listProjectRepository struct {
	domain.ProjectRepository
	all   []*domain.Project
	page  shared.PageResult[*domain.Project]
	query shared.PageQuery
	err   error
}

func (r *listProjectRepository) FindAll(context.Context) ([]*domain.Project, error) {
	return r.all, r.err
}

func (r *listProjectRepository) FindPage(_ context.Context, q shared.PageQuery) (shared.PageResult[*domain.Project], error) {
	r.query = q
	return r.page, r.err
}

type roadmapSummaryStub struct {
	result map[shared.ID]RoadmapSummaryDTO
	ids    []shared.ID
	calls  int
	err    error
}

func (s *roadmapSummaryStub) ReadSummaries(_ context.Context, ids []shared.ID) (map[shared.ID]RoadmapSummaryDTO, error) {
	s.calls++
	s.ids = ids
	return s.result, s.err
}

func summaryProject(t *testing.T, title string) *domain.Project {
	t.Helper()
	p, err := domain.NewProject(shared.NewID(), title, "")
	require.NoError(t, err)
	return p
}

func TestListAttachesRoadmapSummariesInProjectOrder(t *testing.T) {
	first, second := summaryProject(t, "Violet"), summaryProject(t, "Empty")
	date := "2026-10-18"
	summaries := &roadmapSummaryStub{result: map[shared.ID]RoadmapSummaryDTO{
		first.ID(): {
			Progress:        RoadmapProgressDTO{Planned: 1, InProgress: 1, Completed: 1, Total: 3, Percent: 33},
			InProgress:      []RoadmapItemPreviewDTO{{ID: shared.NewID().String(), Number: 2, Title: "Developing"}},
			LatestCompleted: &RoadmapItemPreviewDTO{ID: shared.NewID().String(), Number: 3, Title: "Delivered", CompletionDate: &date},
		},
	}}
	svc := NewService(&listProjectRepository{all: []*domain.Project{first, second}}).WithRoadmapSummaries(summaries)
	items, err := svc.List(context.Background())
	require.NoError(t, err)
	require.Len(t, items, 2)
	assert.Equal(t, []shared.ID{first.ID(), second.ID()}, summaries.ids)
	assert.Equal(t, 1, summaries.calls)
	assert.Equal(t, first.ID().String(), items[0].ID)
	assert.Equal(t, second.ID().String(), items[1].ID)
	require.NotNil(t, items[0].Roadmap)
	assert.Equal(t, summaries.result[first.ID()], *items[0].Roadmap)
	require.NotNil(t, items[1].Roadmap)
	assert.Equal(t, RoadmapProgressDTO{}, items[1].Roadmap.Progress)
	assert.NotNil(t, items[1].Roadmap.InProgress)
	assert.Nil(t, items[1].Roadmap.LatestCompleted)

	encoded, err := json.Marshal(items[1])
	require.NoError(t, err)
	var body map[string]any
	require.NoError(t, json.Unmarshal(encoded, &body))
	roadmap := body["roadmap"].(map[string]any)
	assert.Equal(t, []any{}, roadmap["in_progress"])
	assert.Nil(t, roadmap["latest_completed"])

	encoded, err = json.Marshal(ToDTO(first))
	require.NoError(t, err)
	var detail map[string]any
	require.NoError(t, json.Unmarshal(encoded, &detail))
	assert.NotContains(t, detail, "roadmap", "独立详情不附带仅用于列表的摘要")
}

func TestListPageAttachesSummariesOnlyForCurrentPage(t *testing.T) {
	p := summaryProject(t, "Current page")
	q := shared.PageQuery{Page: 2, Limit: 2}
	repo := &listProjectRepository{page: shared.NewPageResult(q, []*domain.Project{p}, 7)}
	summaries := &roadmapSummaryStub{result: map[shared.ID]RoadmapSummaryDTO{
		p.ID(): {Progress: RoadmapProgressDTO{Planned: 1, Total: 1}},
	}}
	page, err := NewService(repo).WithRoadmapSummaries(summaries).ListPage(context.Background(), q)
	require.NoError(t, err)
	assert.Equal(t, q, repo.query)
	assert.Equal(t, q.Page, page.Page)
	assert.Equal(t, q.Limit, page.Limit)
	assert.Equal(t, int64(7), page.Total)
	require.Len(t, page.Items, 1)
	assert.Equal(t, []shared.ID{p.ID()}, summaries.ids)
	assert.Equal(t, 1, summaries.calls)
	require.NotNil(t, page.Items[0].Roadmap)
	assert.Equal(t, 1, page.Items[0].Roadmap.Progress.Total)
}

func TestProjectListsSkipSummaryQueryWhenEmpty(t *testing.T) {
	summaries := &roadmapSummaryStub{}
	svc := NewService(&listProjectRepository{}).WithRoadmapSummaries(summaries)
	items, err := svc.List(context.Background())
	require.NoError(t, err)
	assert.NotNil(t, items)
	assert.Empty(t, items)
	page, err := svc.ListPage(context.Background(), shared.PageQuery{Page: 1, Limit: 20})
	require.NoError(t, err)
	assert.NotNil(t, page.Items)
	assert.Empty(t, page.Items)
	assert.Zero(t, summaries.calls)
}

func TestProjectListsPropagateQueryErrors(t *testing.T) {
	queryErr := errors.New("query unavailable")
	for _, summaryFails := range []bool{false, true} {
		p := summaryProject(t, "Project")
		repo := &listProjectRepository{all: []*domain.Project{p},
			page: shared.NewPageResult(shared.PageQuery{Page: 1, Limit: 20}, []*domain.Project{p}, 1)}
		summaries := &roadmapSummaryStub{}
		if summaryFails {
			summaries.err = queryErr
		} else {
			repo.err = queryErr
		}
		svc := NewService(repo).WithRoadmapSummaries(summaries)
		items, err := svc.List(context.Background())
		assert.ErrorIs(t, err, queryErr)
		assert.Nil(t, items)
		page, err := svc.ListPage(context.Background(), shared.PageQuery{Page: 1, Limit: 20})
		assert.ErrorIs(t, err, queryErr)
		assert.Empty(t, page.Items)
		if summaryFails {
			assert.Equal(t, 2, summaries.calls)
		} else {
			assert.Zero(t, summaries.calls)
		}
	}
}
