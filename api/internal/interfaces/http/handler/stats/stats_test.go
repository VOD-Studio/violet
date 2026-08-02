// Package stats 提供 stats 模块的 HTTP handler 测试。
//
// stats.Handler 持有具体 *appstats.Service（非接口），无法直接注入 stub service。
// 故构造真实 appstats.Service，替换其依赖的 domainstats.StatsStore 为手写 stub。
package stats

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appstats "blog-api/internal/application/stats"
	domainstats "blog-api/internal/domain/stats"
)

// stubStatsStore 手写 stub，实现 domainstats.StatsStore。
type stubStatsStore struct {
	dashboard  domainstats.DashboardStats
	viewTrends domainstats.ViewTrends
	public     domainstats.PublicStats
	err        error
}

func (s *stubStatsStore) GetDashboard(context.Context) (domainstats.DashboardStats, error) {
	return s.dashboard, s.err
}

func (s *stubStatsStore) GetViewTrends(context.Context) (domainstats.ViewTrends, error) {
	return s.viewTrends, s.err
}

func (s *stubStatsStore) GetPublic(context.Context) (domainstats.PublicStats, error) {
	return s.public, s.err
}

var _ domainstats.StatsStore = (*stubStatsStore)(nil)

func newStatsHandler(store *stubStatsStore) *Handler {
	return NewHandler(appstats.NewService(store))
}

// =====================================================================
// GetPublicStats（公开）
// =====================================================================

func TestGetPublicStats_OK_ReturnsPublicStats(t *testing.T) {
	store := &stubStatsStore{public: domainstats.PublicStats{
		PostsCount:    42,
		TotalWords:    100000,
		CommentsCount: 7,
		UptimeDays:    365,
	}}
	h := newStatsHandler(store)

	rr := httptest.NewRecorder()
	h.GetPublicStats(rr, httptest.NewRequest(http.MethodGet, "/stats/public", nil))

	require.Equal(t, http.StatusOK, rr.Code)

	var got struct {
		Data domainstats.PublicStats `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &got))
	assert.Equal(t, int64(42), got.Data.PostsCount)
	assert.Equal(t, int64(100000), got.Data.TotalWords)
	assert.Equal(t, int64(7), got.Data.CommentsCount)
	assert.Equal(t, int64(365), got.Data.UptimeDays)
}

// =====================================================================
// GetDashboardStats（后台）
// =====================================================================

func TestGetDashboardStats_OK_ReturnsDashboard(t *testing.T) {
	store := &stubStatsStore{dashboard: domainstats.DashboardStats{
		TotalPosts:      10,
		TotalComments:   50,
		PendingComments: 3,
		TotalViews:      9999,
		TotalUsers:      8,
	}}
	h := newStatsHandler(store)

	rr := httptest.NewRecorder()
	h.GetDashboardStats(rr, httptest.NewRequest(http.MethodGet, "/admin/stats/dashboard", nil))

	require.Equal(t, http.StatusOK, rr.Code)

	var got struct {
		Data domainstats.DashboardStats `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &got))
	assert.Equal(t, int64(10), got.Data.TotalPosts)
	assert.Equal(t, int64(3), got.Data.PendingComments)
	assert.Equal(t, int64(9999), got.Data.TotalViews)
}
