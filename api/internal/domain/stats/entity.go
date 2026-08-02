// Package stats 提供仪表盘统计的领域模型。
package stats

import "context"

// DashboardStats 后台总览统计
type DashboardStats struct {
	// TotalPosts 文章总数
	TotalPosts int64 `json:"total_posts"`
	// TotalComments 评论总数（含待审核）
	TotalComments int64 `json:"total_comments"`
	// PendingComments 待审核评论数
	PendingComments int64 `json:"pending_comments"`
	// TotalViews 累计浏览量
	TotalViews int64 `json:"total_views"`
	// TotalUsers 注册用户总数
	TotalUsers int64 `json:"total_users"`
	// RecentPosts 最近发布的文章摘要列表
	RecentPosts []PostSummary `json:"recent_posts"`
	// PopularPosts 热门文章摘要列表（按浏览量排序）
	PopularPosts []PostSummary `json:"popular_posts"`
}

// PostSummary 文章摘要
type PostSummary struct {
	// ID 文章 ID
	ID string `json:"id"`
	// Title 文章标题
	Title string `json:"title"`
	// Slug 文章 URL slug
	Slug string `json:"slug"`
	// Status 文章发布状态
	Status string `json:"status"`
	// ViewCount 浏览量
	ViewCount int `json:"view_count"`
	// PublishedAt 发布时间（指针，未发布为 nil；omitempty 序列化时省略）
	PublishedAt *string `json:"published_at,omitempty"`
}

// ViewTrends 浏览量趋势
type ViewTrends struct {
	// Daily 按日聚合的浏览量数据点
	Daily []ViewPoint `json:"daily"`
	// Monthly 按月聚合的浏览量数据点
	Monthly []ViewPoint `json:"monthly"`
}

// ViewPoint 浏览量数据点
type ViewPoint struct {
	// Label 横轴标签（日聚合为 YYYY-MM-DD，月聚合为 YYYY-MM）
	Label string `json:"label"`
	// Count 该时间点对应的浏览量
	Count int64 `json:"count"`
}

// PublicStats 公开只读统计（About 页站点生命体征区块用）
//
// 与 DashboardStats 的区别：仅暴露安全字段，口径面向访客——
// 只统计已发布文章、已通过审核评论；不含 pending/users/浏览量等 admin 维度。
type PublicStats struct {
	// PostsCount 已发布文章数
	PostsCount int64 `json:"posts_count"`
	// TotalWords 已发布文章总字数
	TotalWords int64 `json:"total_words"`
	// CommentsCount 已通过审核评论数
	CommentsCount int64 `json:"comments_count"`
	// UptimeDays 站点上线至今天数
	UptimeDays int64 `json:"uptime_days"`
}

// StatsStore 统计查询端口
type StatsStore interface {
	GetDashboard(ctx context.Context) (DashboardStats, error)
	GetViewTrends(ctx context.Context) (ViewTrends, error)
	GetPublic(ctx context.Context) (PublicStats, error)
}
