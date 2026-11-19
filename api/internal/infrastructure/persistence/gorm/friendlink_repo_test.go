package gorm

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	app "blog-api/internal/application/friendlink"
	appshared "blog-api/internal/application/shared"
	domain "blog-api/internal/domain/friendlink"
	"blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
	friendhttp "blog-api/internal/interfaces/http/handler/friendlink"
)

func TestFriendLinkPublicOrderingAndFailureSnapshot(t *testing.T) {
	db := setupTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.FriendLink{}))
	ctx := t.Context()
	repo := NewFriendLinkRepository(db)
	now := time.Date(2026, 11, 18, 10, 0, 0, 0, time.UTC)
	old := now.Add(-time.Hour)
	rows := []model.FriendLink{
		{ID: uuid.MustParse("00000000-0000-4000-8000-000000000001"), Name: "old", URL: "https://old.example", RSSURL: "https://old.example/feed", Status: domain.StatusApproved, LatestPublishedAt: &old},
		{ID: uuid.MustParse("00000000-0000-4000-8000-000000000002"), Name: "latest-a", URL: "https://a.example", RSSURL: "https://a.example/feed", Status: domain.StatusApproved, LatestPublishedAt: &now, LatestTitle: "文章", LatestURL: "https://a.example/new", FeedStatus: domain.FeedOK},
		{ID: uuid.MustParse("00000000-0000-4000-8000-000000000003"), Name: "latest-b", URL: "https://b.example", Status: domain.StatusApproved, LatestPublishedAt: &now},
		{ID: uuid.MustParse("00000000-0000-4000-8000-000000000004"), Name: "no-date", URL: "https://none.example", Status: domain.StatusApproved},
		{ID: uuid.New(), Name: "pending", URL: "https://pending.example", Status: domain.StatusPending, LatestPublishedAt: &now},
		{ID: uuid.New(), Name: "disabled", URL: "https://disabled.example", Status: domain.StatusDisabled, LatestPublishedAt: &now},
		{ID: uuid.New(), Name: "rejected", URL: "https://rejected.example", Status: domain.StatusRejected, LatestPublishedAt: &now},
	}
	for i := range rows {
		require.NoError(t, db.Create(&rows[i]).Error)
	}
	first, err := repo.FindApprovedPage(ctx, "updated", shared.PageQuery{Page: 1, Limit: 2})
	require.NoError(t, err)
	require.EqualValues(t, 4, first.Total)
	require.Equal(t, []string{"latest-a", "latest-b"}, []string{first.Items[0].Name(), first.Items[1].Name()})
	second, err := repo.FindApprovedPage(ctx, "updated", shared.PageQuery{Page: 2, Limit: 2})
	require.NoError(t, err)
	require.Equal(t, []string{"old", "no-date"}, []string{second.Items[0].Name(), second.Items[1].Name()})
	link := first.Items[0]
	require.NoError(t, repo.SaveActivity(ctx, link, domain.Activity{FeedStatus: domain.FeedError, SiteStatus: domain.SiteDown, CheckedAt: &now}))
	reloaded, err := repo.FindByID(ctx, link.ID())
	require.NoError(t, err)
	require.True(t, reloaded.IsApproved())
	require.Equal(t, domain.FeedError, reloaded.Activity().FeedStatus)
	require.Equal(t, "https://a.example/new", reloaded.Activity().LatestURL)
	require.True(t, reloaded.Activity().LatestPublishedAt.Equal(now))
	// 保存刷新前取出的业务实体也不能抹掉新快照。
	require.NoError(t, repo.Save(ctx, link))
	reloaded, err = repo.FindByID(ctx, link.ID())
	require.NoError(t, err)
	require.Equal(t, domain.FeedError, reloaded.Activity().FeedStatus)
	// 改源清空旧文章；旧请求完成后不能把文章写回新源。
	require.NoError(t, reloaded.Update(domain.UpdateParams{Name: reloaded.Name(), URL: reloaded.URL(), RSSURL: "https://a.example/new-feed"}))
	require.NoError(t, repo.Save(ctx, reloaded))
	require.NoError(t, repo.SaveActivity(ctx, link, domain.Activity{FeedStatus: domain.FeedOK, SiteStatus: domain.SiteUp, LatestURL: "https://a.example/stale", LatestPublishedAt: &now}))
	reloaded, err = repo.FindByID(ctx, link.ID())
	require.NoError(t, err)
	require.Empty(t, reloaded.Activity().LatestURL)
	require.Nil(t, reloaded.Activity().LatestPublishedAt)
}

type friendTestBus struct{}

func (friendTestBus) Publish(context.Context, []shared.DomainEvent) error { return nil }
func (friendTestBus) Subscribe(string, appshared.EventHandler)            {}

type refreshFixture struct{ at time.Time }

func (f refreshFixture) Fetch(context.Context, string, string) domain.Activity {
	return domain.Activity{FeedStatus: domain.FeedOK, SiteStatus: domain.SiteUp, CheckedAt: &f.at, LatestTitle: "审核后的新文章", LatestURL: "https://applicant.example/article", LatestPublishedAt: &f.at}
}

func TestFriendLinkRSSApplicationApprovalAndControlledRefresh(t *testing.T) {
	db := setupTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.FriendLink{}))
	repo := NewFriendLinkRepository(db)
	svc := app.NewService(repo, nil, nil, friendTestBus{})
	applied, err := svc.Apply(t.Context(), app.ApplyInput{UserID: uuid.NewString(), ContactEmail: "reader@example.com", Name: "申请站", URL: "https://applicant.example", RSSURL: "https://applicant.example/feed.xml"})
	require.NoError(t, err)
	public, err := repo.FindApproved(t.Context())
	require.NoError(t, err)
	require.Empty(t, public)
	h := friendhttp.NewHandler(svc, nil)
	r := httptest.NewRequest(http.MethodPost, "/admin/friend-links/"+applied.ID+"/approve", nil)
	r.SetPathValue("id", applied.ID)
	w := httptest.NewRecorder()
	h.Approve(w, r)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	worker := app.NewRefreshWorker(repo, refreshFixture{at: time.Date(2026, 11, 18, 10, 0, 0, 0, time.UTC)})
	require.NoError(t, worker.Refresh(t.Context()))
	items, total, err := svc.ListPublicPage(t.Context(), "updated", 1, 9)
	require.NoError(t, err)
	require.EqualValues(t, 1, total)
	require.Len(t, items, 1)
	require.Equal(t, "https://applicant.example/feed.xml", items[0].RSSURL)
	require.Equal(t, "https://applicant.example/article", items[0].LatestURL)
	require.Equal(t, domain.FeedOK, items[0].FeedStatus)
}
