package gorm

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	appactivity "blog-api/internal/application/repositoryactivity"
	"blog-api/internal/domain/project"
	activity "blog-api/internal/domain/repositoryactivity"
	"blog-api/internal/domain/shared"
)

func TestRepositoryGrowthUsesCompletePublicHistory(t *testing.T) {
	db := setupIntegrationDB(t)
	ctx := t.Context()
	projects := NewProjectRepository(db)
	storage := NewRepositoryActivityRepository(db)
	service := appactivity.NewService(projects, nil, storage)
	const repo = "owner/garden"
	now := time.Now()
	for order, link := range []string{"https://github.com/Owner/Garden", "https://github.com/owner/garden/"} {
		p := project.ReconstructProject(shared.NewID(), "花园", []string{"garden", "same-garden"}[order],
			"", "", link, "", "", project.StatusActive, nil, order, now, now)
		require.NoError(t, projects.Save(ctx, p))
	}
	other := project.ReconstructProject(shared.NewID(), "另一个公开项目", "other",
		"", "", "https://github.com/owner/other", "", "", project.StatusActive, nil, 2, now, now)
	require.NoError(t, projects.Save(ctx, other))
	complete := activity.Stream{Initialized: true, SweptAt: now}
	source := activity.Source{
		Key: repo, RepositoryID: 100, DefaultBranch: "main", AttemptedAt: now,
		VerifiedAt: &now, DataAt: &now, SyncedAt: &now, Releases: complete,
		Commits: activity.Stream{Initialized: true, BackfillPage: 2},
	}
	first := activity.Event{Kind: activity.KindCommit, ID: "old", Title: "第一次提交", URL: "https://github.com/owner/garden/commit/old",
		OccurredAt: time.Date(2020, 1, 5, 15, 59, 0, 0, time.UTC)} // 上海周日。
	monday := activity.Event{Kind: activity.KindCommit, ID: "new", Title: "下周的提交", URL: "https://github.com/owner/garden/commit/new",
		OccurredAt: first.OccurredAt.Add(time.Minute)} // 上海周一 00:00。
	version := activity.Event{Kind: activity.KindRelease, ID: "42", Tag: "v1.0.0", Title: "第一次发布",
		URL: "https://github.com/owner/garden/releases/tag/v1.0.0", OccurredAt: monday.OccurredAt}
	otherSource := source
	otherSource.Key, otherSource.RepositoryID, otherSource.Commits = "owner/other", 101, complete
	require.NoError(t, storage.Save(ctx, otherSource, activity.Change{Events: []activity.Event{first}, SeenAt: now}))
	require.NoError(t, storage.Save(ctx, source, activity.Change{Events: []activity.Event{monday, version}, SeenAt: now}))

	partial, err := service.Growth(ctx, repo)
	require.NoError(t, err)
	require.False(t, partial.HistoryComplete)
	require.Nil(t, partial.FirstCommit)
	require.Nil(t, partial.ElapsedDays)
	require.Empty(t, partial.Weeks)
	require.Len(t, partial.Releases, 1, "公开版本不必等待提交历史回填")

	source.Commits = complete
	require.NoError(t, storage.Save(ctx, source, activity.Change{Events: []activity.Event{first, monday}, SeenAt: now}))
	growth, err := service.Growth(ctx, repo)
	require.NoError(t, err)
	require.True(t, growth.HistoryComplete)
	require.NotNil(t, growth.FirstCommit)
	require.Equal(t, first.URL, growth.FirstCommit.URL)
	require.NotNil(t, growth.ElapsedDays)
	today, err := time.Parse(time.DateOnly, growth.Today)
	require.NoError(t, err)
	require.Equal(t, int(today.Sub(time.Date(2020, 1, 5, 0, 0, 0, 0, time.UTC)).Hours()/24), *growth.ElapsedDays)
	require.Equal(t, []activity.GrowthWeek{{Start: "2019-12-30", CommitCount: 1}, {Start: "2020-01-06", CommitCount: 1}}, growth.Weeks)
	require.Len(t, growth.Releases, 1)
	require.Equal(t, version.URL, growth.Releases[0].URL)

	empty, err := service.Growth(ctx, "owner/not-allowed")
	require.NoError(t, err)
	require.Equal(t, activity.StateUnconfigured, empty.Health.State)
	require.Empty(t, empty.Releases)

	source.Unavailable = true
	require.NoError(t, storage.Save(ctx, source, activity.Change{}))
	revoked, err := service.Growth(ctx, repo)
	require.NoError(t, err)
	require.Equal(t, activity.StateFailed, revoked.Health.State)
	require.False(t, revoked.HistoryComplete)
	require.Nil(t, revoked.FirstCommit)
	require.Empty(t, revoked.Weeks)
	require.Empty(t, revoked.Releases)
}
