package gorm

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appactivity "blog-api/internal/application/repositoryactivity"
	"blog-api/internal/domain/project"
	activity "blog-api/internal/domain/repositoryactivity"
	"blog-api/internal/domain/shared"
)

func TestRepositoryActivityIntegration(t *testing.T) {
	db := setupIntegrationDB(t)
	ctx := t.Context()
	projects := NewProjectRepository(db)
	storage := NewRepositoryActivityRepository(db)
	const sourceKey = "owner/repo"
	first := project.ReconstructProject(shared.MustParseID("00000000-0000-0000-0000-000000000010"), "第一个", "first", "", "", "https://github.com/Owner/Repo", "", []string{}, 0, time.Now(), time.Now())
	second := project.ReconstructProject(shared.MustParseID("00000000-0000-0000-0000-000000000020"), "第二个", "second", "", "", "https://github.com/owner/repo/", "", []string{}, 1, time.Now(), time.Now())
	require.NoError(t, projects.Save(ctx, first))
	require.NoError(t, projects.Save(ctx, second))

	monday := time.Date(2026, 11, 15, 16, 0, 0, 0, time.UTC)
	commit := func(i int, at time.Time) activity.Event {
		sha := fmt.Sprintf("%040x", i)
		return activity.Event{Kind: activity.KindCommit, ID: sha, Title: fmt.Sprintf("commit %d", i), URL: "https://github.com/Owner/Repo/commit/" + sha, OccurredAt: at}
	}
	commits := make([]activity.Event, 8)
	for i := range commits {
		commits[i] = commit(8-i, monday.Add(time.Duration(7-i)*time.Minute))
	}
	previous := commit(9, monday.Add(-time.Minute))
	latestRelease := activity.Event{Kind: activity.KindRelease, ID: "23", Tag: "v1.0.0", Title: "初次发布", URL: "https://github.com/Owner/Repo/releases/tag/v1.0.0", OccurredAt: monday.Add(20 * time.Minute)}
	provider := &repositoryActivityFixture{
		commitPages: map[activityFixturePage]activity.Page{
			{"release/2.0", 1}: {Events: commits[:4], HasNext: true},
			{commits[0].ID, 2}: {Events: commits[3:], HasNext: true}, // 跨页重复返回的提交只计一次。
			{commits[0].ID, 3}: {Events: []activity.Event{previous}},
		},
		release: activity.Page{Events: []activity.Event{latestRelease, latestRelease}},
	}
	svc := appactivity.NewService(projects, provider, storage)
	days, health, err := svc.Browse(ctx, nil, nil, 20)
	require.NoError(t, err)
	assert.Empty(t, days)
	assert.Equal(t, activity.StateSyncing, health.State)
	assert.Zero(t, provider.inspections)

	require.NoError(t, svc.Sync(ctx))
	assert.Equal(t, 1, provider.inspections, "two projects share one repository sync")
	assert.Equal(t, []activityFixturePage{{"release/2.0", 1}, {commits[0].ID, 2}}, provider.requested)
	days, health, err = svc.Browse(ctx, nil, nil, 20)
	require.NoError(t, err)
	require.Len(t, days, 2, "the first batch is visible before the remaining history is collected")
	assert.Equal(t, activity.StateReady, health.State)
	require.NotNil(t, health.LastSyncedAt)
	assert.Equal(t, "2026-11-16", days[0].Day)
	assert.Equal(t, second.ID().String(), days[0].Project.ID)
	assert.Equal(t, first.ID().String(), days[1].Project.ID)
	assert.Equal(t, 8, days[0].CommitCount)
	assert.Len(t, days[0].Commits, 6)
	assert.Equal(t, 1, days[0].ReleaseCount)
	assert.Equal(t, "初次发布", days[0].Summary)
	assert.True(t, days[0].FirstAt.Equal(monday))
	assert.True(t, days[0].LastAt.Equal(latestRelease.OccurredAt))
	initial, err := svc.GetDay(ctx, first.ID(), "2026-11-16")
	require.NoError(t, err)
	require.Len(t, initial.Commits, 8)
	assert.Equal(t, commits[0].ID, initial.Commits[0].SHA)

	provider.requested = nil
	require.NoError(t, svc.Sync(ctx))
	require.NoError(t, svc.Sync(ctx))
	assert.Equal(t, []activityFixturePage{{"release/2.0", 1}, {commits[0].ID, 3}, {"release/2.0", 1}}, provider.requested)
	days, _, err = svc.Browse(ctx, nil, &activity.Cursor{Day: "2026-11-16", ProjectID: second.ID()}, 2)
	require.NoError(t, err)
	require.Len(t, days, 2)
	assert.Equal(t, first.ID().String(), days[0].Project.ID)
	assert.Equal(t, 8, days[0].CommitCount, "three sync rounds still count eight unique commits")
	assert.Equal(t, "2026-11-15", days[1].Day)
	assert.Equal(t, second.ID().String(), days[1].Project.ID)
	assert.NotNil(t, days[1].Releases, "empty child collections are JSON arrays")
	assert.Empty(t, days[1].Releases)
	days, _, err = svc.Browse(ctx, nil, &activity.Cursor{Day: "2026-11-16"}, 20)
	require.NoError(t, err)
	require.Len(t, days, 2)
	assert.Equal(t, "2026-11-15", days[0].Day)
	var week string
	require.NoError(t, db.Raw("SELECT to_char(activity_week, 'YYYY-MM-DD') FROM repository_activity_events WHERE source_id = ?", previous.ID).Scan(&week).Error)
	assert.Equal(t, "2026-11-09", week, "the shared SQL source rolls the week on Shanghai Monday")

	// A rolling reconciliation can discover a commit older than an already-seen head, and remove a withdrawn release.
	states, err := storage.Sources(ctx, []string{sourceKey})
	require.NoError(t, err)
	state := states[sourceKey]
	state.Commits.SweptAt = time.Now().Add(-25 * time.Hour)
	state.Releases.SweptAt = state.Commits.SweptAt
	require.NoError(t, storage.Save(ctx, state, activity.Change{}))
	merged := commit(123, monday.Add(-2*time.Minute))
	provider.commitPages[activityFixturePage{commits[0].ID, 3}] = activity.Page{Events: []activity.Event{previous, merged}}
	provider.release = activity.Page{}
	require.NoError(t, svc.Sync(ctx))
	require.NoError(t, svc.Sync(ctx))
	withdrawn, err := svc.GetDay(ctx, first.ID(), "2026-11-16")
	require.NoError(t, err)
	assert.Zero(t, withdrawn.ReleaseCount)
	older, err := svc.GetDay(ctx, first.ID(), "2026-11-15")
	require.NoError(t, err)
	assert.Equal(t, 2, older.CommitCount)

	require.NoError(t, first.Update(first.Title(), "", "", "https://github.com/elsewhere/new", ""))
	require.NoError(t, projects.Save(ctx, first))
	_, err = svc.GetDay(ctx, first.ID(), "2026-11-16")
	require.ErrorIs(t, err, activity.ErrNotFound)
	_, err = storage.GetDay(ctx, activity.Binding{ProjectID: first.ID(), URL: "https://github.com/Owner/Repo", Key: sourceKey}, "2026-11-16", time.Now().Add(-time.Hour))
	require.ErrorIs(t, err, activity.ErrNotFound, "the SQL snapshot also rejects outdated mappings")
	require.NoError(t, projects.Delete(ctx, first.ID()))

	temporary := errors.New("temporary network failure")
	provider.inspectErr = temporary
	require.ErrorIs(t, svc.Sync(ctx), temporary)
	days, health, err = svc.Browse(ctx, nil, nil, 20)
	require.NoError(t, err)
	require.Len(t, days, 2)
	assert.Equal(t, activity.StateStale, health.State)
	require.NotNil(t, health.Reason)
	assert.Equal(t, activity.ReasonFailed, *health.Reason)

	limited := &activity.RateLimitError{RetryAt: time.Now().Add(time.Hour)}
	provider.inspectErr = limited
	require.ErrorIs(t, svc.Sync(ctx), limited)
	inspections := provider.inspections
	require.NoError(t, svc.Sync(ctx))
	assert.Equal(t, inspections, provider.inspections, "the persisted retry deadline suppresses requests")
	days, health, err = svc.Browse(ctx, nil, nil, 20)
	require.NoError(t, err)
	require.Len(t, days, 2)
	assert.Equal(t, activity.StateStale, health.State)
	require.NotNil(t, health.Reason)
	assert.Equal(t, activity.ReasonLimited, *health.Reason)

	states, err = storage.Sources(ctx, []string{sourceKey})
	require.NoError(t, err)
	state = states[sourceKey]
	expired := time.Now().Add(-25 * time.Hour)
	state.SyncedAt = &expired
	require.NoError(t, storage.Save(ctx, state, activity.Change{}))
	days, health, err = svc.Browse(ctx, nil, nil, 20)
	require.NoError(t, err)
	assert.Empty(t, days)
	assert.Equal(t, activity.StateLimited, health.State)

	state.SyncedAt = state.VerifiedAt
	state.RetryAt = &expired
	require.NoError(t, storage.Save(ctx, state, activity.Change{}))
	provider.inspectErr = activity.ErrUnavailable
	require.NoError(t, svc.Sync(ctx))
	days, health, err = svc.Browse(ctx, nil, nil, 20)
	require.NoError(t, err)
	assert.Empty(t, days, "a fresh cache is revoked on the same round as a visibility failure")
	assert.Equal(t, activity.StateFailed, health.State)
	_, err = svc.GetDay(ctx, second.ID(), "2026-11-16")
	require.ErrorIs(t, err, activity.ErrNotFound)

	require.NoError(t, projects.Delete(ctx, second.ID()))
	days, health, err = svc.Browse(ctx, nil, nil, 20)
	require.NoError(t, err)
	assert.Empty(t, days)
	assert.Equal(t, activity.StateUnconfigured, health.State)
}

type activityFixturePage struct {
	ref  string
	page int
}

type repositoryActivityFixture struct {
	inspections int
	inspectErr  error
	commitPages map[activityFixturePage]activity.Page
	requested   []activityFixturePage
	release     activity.Page
}

func (p *repositoryActivityFixture) Inspect(_ context.Context, key string) (activity.Remote, error) {
	p.inspections++
	return activity.Remote{ID: 719, Key: key, DefaultBranch: "release/2.0"}, p.inspectErr
}

func (p *repositoryActivityFixture) Commits(_ context.Context, _ activity.Remote, ref string, page int) (activity.Page, error) {
	key := activityFixturePage{ref, page}
	p.requested = append(p.requested, key)
	response, ok := p.commitPages[key]
	if !ok {
		return activity.Page{}, fmt.Errorf("unexpected commit request: %+v", key)
	}
	return response, nil
}

func (p *repositoryActivityFixture) Releases(context.Context, activity.Remote, int) (activity.Page, error) {
	return p.release, nil
}
