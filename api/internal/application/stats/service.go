// Package stats 提供仪表盘统计的应用用例。
package stats

import (
	"context"

	domainstats "blog-api/internal/domain/stats"
)

// Service 统计用例服务
type Service struct {
	store domainstats.StatsStore
}

// NewService 构造统计服务
func NewService(store domainstats.StatsStore) *Service {
	return &Service{store: store}
}

// GetDashboard 获取后台总览统计
func (s *Service) GetDashboard(ctx context.Context) (domainstats.DashboardStats, error) {
	return s.store.GetDashboard(ctx)
}

// GetViewTrends 获取浏览量趋势
func (s *Service) GetViewTrends(ctx context.Context) (domainstats.ViewTrends, error) {
	return s.store.GetViewTrends(ctx)
}

// GetPublic 获取公开只读统计（About 页站点生命体征用，仅安全字段）
func (s *Service) GetPublic(ctx context.Context) (domainstats.PublicStats, error) {
	return s.store.GetPublic(ctx)
}
