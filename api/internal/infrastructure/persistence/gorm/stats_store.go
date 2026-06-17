// Package gorm 提供 stats 模块的 GORM 存储实现。
package gorm

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"

	domainstats "blog-api/internal/domain/stats"
	newmodel "blog-api/internal/infrastructure/persistence/gorm/model"
)

// StatsStore 实现领域 StatsStore 端口
type StatsStore struct{ db *gorm.DB }

// NewStatsStore 创建统计存储
func NewStatsStore(db *gorm.DB) *StatsStore {
	return &StatsStore{db: db}
}

func (s *StatsStore) GetDashboard(ctx context.Context) (domainstats.DashboardStats, error) {
	var stats domainstats.DashboardStats
	s.db.WithContext(ctx).Model(&newmodel.Post{}).Count(&stats.TotalPosts)
	s.db.WithContext(ctx).Model(&newmodel.Comment{}).Count(&stats.TotalComments)
	s.db.WithContext(ctx).Model(&newmodel.Comment{}).Where("status = ?", "pending").Count(&stats.PendingComments)
	s.db.WithContext(ctx).Model(&newmodel.User{}).Count(&stats.TotalUsers)

	type viewSum struct{ Total int64 }
	var vs viewSum
	s.db.WithContext(ctx).Model(&newmodel.Post{}).Select("COALESCE(SUM(view_count),0) AS total").Scan(&vs)
	stats.TotalViews = vs.Total

	// 最近 5 篇文章
	var recent []newmodel.Post
	s.db.WithContext(ctx).Order("created_at DESC").Limit(5).Find(&recent)
	for _, p := range recent {
		stats.RecentPosts = append(stats.RecentPosts, postToSummary(p))
	}
	// 热门 5 篇（按浏览量）
	var popular []newmodel.Post
	s.db.WithContext(ctx).Where("status = ?", "published").Order("view_count DESC").Limit(5).Find(&popular)
	for _, p := range popular {
		stats.PopularPosts = append(stats.PopularPosts, domainstats.PostSummary{
			ID: p.ID.String(), Title: p.Title, Slug: p.Slug, ViewCount: p.ViewCount,
		})
	}
	return stats, nil
}

func (s *StatsStore) GetViewTrends(ctx context.Context) (domainstats.ViewTrends, error) {
	var trends domainstats.ViewTrends
	// 最近 30 天每日浏览量（从 post_views 表）
	now := time.Now()
	from := now.AddDate(0, 0, -30)
	type dailyRow struct {
		Date  string
		Count int64
	}
	var daily []dailyRow
	s.db.WithContext(ctx).
		Table("post_views").
		Select("TO_CHAR(created_at, 'YYYY-MM-DD') AS date, COUNT(*) AS count").
		Where("created_at >= ?", from).
		Group("date").Order("date ASC").
		Scan(&daily)
	for _, d := range daily {
		trends.Daily = append(trends.Daily, domainstats.ViewPoint{Label: d.Date, Count: d.Count})
	}
	// 最近 12 个月每月浏览量
	fromMonth := now.AddDate(-1, 0, 0)
	type monthRow struct {
		Month string
		Count int64
	}
	var monthly []monthRow
	s.db.WithContext(ctx).
		Table("post_views").
		Select("TO_CHAR(created_at, 'YYYY-MM') AS month, COUNT(*) AS count").
		Where("created_at >= ?", fromMonth).
		Group("month").Order("month ASC").
		Scan(&monthly)
	for _, m := range monthly {
		trends.Monthly = append(trends.Monthly, domainstats.ViewPoint{Label: m.Month, Count: m.Count})
	}
	return trends, nil
}

func postToSummary(p newmodel.Post) domainstats.PostSummary {
	s := domainstats.PostSummary{
		ID: p.ID.String(), Title: p.Title, Slug: p.Slug,
		Status: p.Status, ViewCount: p.ViewCount,
	}
	if !p.PublishedAt.IsZero() {
		t := p.PublishedAt.Format(time.RFC3339)
		s.PublishedAt = &t
	}
	return s
}

var _ = fmt.Sprintf // avoid unused if TO_CHAR format changes
