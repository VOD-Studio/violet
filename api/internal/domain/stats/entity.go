// Package stats 提供仪表盘统计的领域模型。
package stats

import "context"

// DashboardStats 后台总览统计
type DashboardStats struct {
	TotalPosts      int64         `json:"total_posts"`
	TotalComments   int64         `json:"total_comments"`
	PendingComments int64         `json:"pending_comments"`
	TotalViews      int64         `json:"total_views"`
	TotalUsers      int64         `json:"total_users"`
	RecentPosts     []PostSummary `json:"recent_posts"`
	PopularPosts    []PostSummary `json:"popular_posts"`
}

// PostSummary 文章摘要
type PostSummary struct {
	ID          string  `json:"id"`
	Title       string  `json:"title"`
	Slug        string  `json:"slug"`
	Status      string  `json:"status"`
	ViewCount   int     `json:"view_count"`
	PublishedAt *string `json:"published_at,omitempty"`
}

// ViewTrends 浏览量趋势
type ViewTrends struct {
	Daily   []ViewPoint `json:"daily"`
	Monthly []ViewPoint `json:"monthly"`
}

// ViewPoint 浏览量数据点
type ViewPoint struct {
	Label string `json:"label"` // date (YYYY-MM-DD) 或 month (YYYY-MM)
	Count int64  `json:"count"`
}

// StatsStore 统计查询端口
type StatsStore interface {
	GetDashboard(ctx context.Context) (DashboardStats, error)
	GetViewTrends(ctx context.Context) (ViewTrends, error)
}
