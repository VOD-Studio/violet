package stats

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	domainstats "blog-api/internal/domain/stats"
)

// mockStatsStore 手写 StatsStore 桩（application/mocks 包未提供该接口）。
type mockStatsStore struct{ mock.Mock }

func (m *mockStatsStore) GetDashboard(ctx context.Context) (domainstats.DashboardStats, error) {
	args := m.Called(ctx)
	return args.Get(0).(domainstats.DashboardStats), args.Error(1)
}

func (m *mockStatsStore) GetViewTrends(ctx context.Context) (domainstats.ViewTrends, error) {
	args := m.Called(ctx)
	return args.Get(0).(domainstats.ViewTrends), args.Error(1)
}

func (m *mockStatsStore) GetPublic(ctx context.Context) (domainstats.PublicStats, error) {
	args := m.Called(ctx)
	return args.Get(0).(domainstats.PublicStats), args.Error(1)
}

func newSvc() (*Service, *mockStatsStore) {
	store := new(mockStatsStore)
	return NewService(store), store
}

func TestService_GetDashboard(t *testing.T) {
	svc, store := newSvc()
	want := domainstats.DashboardStats{
		TotalPosts:      5,
		TotalComments:   8,
		PendingComments: 1,
		TotalViews:      1000,
		TotalUsers:      3,
	}
	store.On("GetDashboard", mock.Anything).Return(want, nil).Once()

	got, err := svc.GetDashboard(context.Background())
	assert.NoError(t, err)
	assert.Equal(t, want, got)
	store.AssertExpectations(t)
}

func TestService_GetDashboard_Error(t *testing.T) {
	svc, store := newSvc()
	store.On("GetDashboard", mock.Anything).Return(domainstats.DashboardStats{}, assert.AnError).Once()

	_, err := svc.GetDashboard(context.Background())
	assert.Error(t, err)
	store.AssertExpectations(t)
}

func TestService_GetPublic(t *testing.T) {
	svc, store := newSvc()
	want := domainstats.PublicStats{
		PostsCount:    42,
		TotalWords:    120000,
		CommentsCount: 88,
		UptimeDays:    365,
	}
	store.On("GetPublic", mock.Anything).Return(want, nil).Once()

	got, err := svc.GetPublic(context.Background())
	assert.NoError(t, err)
	assert.Equal(t, want, got)
	store.AssertExpectations(t)
}

func TestService_GetPublic_Error(t *testing.T) {
	svc, store := newSvc()
	store.On("GetPublic", mock.Anything).Return(domainstats.PublicStats{}, assert.AnError).Once()

	_, err := svc.GetPublic(context.Background())
	assert.Error(t, err)
	store.AssertExpectations(t)
}
