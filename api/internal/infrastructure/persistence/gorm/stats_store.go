// Package gorm 提供 stats 模块的 GORM 存储实现。
package gorm

import (
	"context"
	"regexp"
	"time"
	"unicode/utf8"

	"gorm.io/gorm"

	domainshared "blog-api/internal/domain/shared"
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
	if err := s.db.WithContext(ctx).Model(&newmodel.Post{}).Count(&stats.TotalPosts).Error; err != nil {
		return stats, domainshared.Internal("统计文章数失败", err)
	}
	if err := s.db.WithContext(ctx).Model(&newmodel.Comment{}).Count(&stats.TotalComments).Error; err != nil {
		return stats, domainshared.Internal("统计评论数失败", err)
	}
	if err := s.db.WithContext(ctx).Model(&newmodel.Comment{}).Where("status = ?", "pending").Count(&stats.PendingComments).Error; err != nil {
		return stats, domainshared.Internal("统计待审评论数失败", err)
	}
	if err := s.db.WithContext(ctx).Model(&newmodel.User{}).Count(&stats.TotalUsers).Error; err != nil {
		return stats, domainshared.Internal("统计用户数失败", err)
	}

	type viewSum struct{ Total int64 }
	var vs viewSum
	if err := s.db.WithContext(ctx).Model(&newmodel.Post{}).Select("COALESCE(SUM(view_count),0) AS total").Scan(&vs).Error; err != nil {
		return stats, domainshared.Internal("统计总浏览量失败", err)
	}
	stats.TotalViews = vs.Total

	// 最近 5 篇文章
	var recent []newmodel.Post
	if err := s.db.WithContext(ctx).Order("created_at DESC").Limit(5).Find(&recent).Error; err != nil {
		return stats, domainshared.Internal("查询最近文章失败", err)
	}
	for _, p := range recent {
		stats.RecentPosts = append(stats.RecentPosts, postToSummary(p))
	}
	// 热门 5 篇（按浏览量）
	var popular []newmodel.Post
	if err := s.db.WithContext(ctx).Where("status = ?", "published").Order("view_count DESC").Limit(5).Find(&popular).Error; err != nil {
		return stats, domainshared.Internal("查询热门文章失败", err)
	}
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
	if err := s.db.WithContext(ctx).
		Table("post_views").
		Select("COALESCE(TO_CHAR(created_at, 'YYYY-MM-DD'),'') AS date, COUNT(*) AS count").
		Where("created_at >= ?", from).
		Group("date").Order("date ASC").
		Scan(&daily).Error; err != nil {
		return trends, domainshared.Internal("查询每日浏览趋势失败", err)
	}
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
	if err := s.db.WithContext(ctx).
		Table("post_views").
		Select("COALESCE(TO_CHAR(created_at, 'YYYY-MM'),'') AS month, COUNT(*) AS count").
		Where("created_at >= ?", fromMonth).
		Group("month").Order("month ASC").
		Scan(&monthly).Error; err != nil {
		return trends, domainshared.Internal("查询每月浏览趋势失败", err)
	}
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
	if p.PublishedAt != nil && !p.PublishedAt.IsZero() {
		t := p.PublishedAt.Format(time.RFC3339)
		s.PublishedAt = &t
	}
	return s
}

var htmlTagRe = regexp.MustCompile(`<[^>]+>`)

// countStrippedChars 统计多篇文章剥离 HTML 标签后的总字符数。
// 按 rune 计数，对齐 PostgreSQL LENGTH(text) 的字符口径。
//
// 应用层计算而非 SQL REGEXP_REPLACE：后者是 PostgreSQL 专属函数，
// 会让 SQLite 集成测试失败；此处保证两个后端口径一致。
func countStrippedChars(htmls []string) int64 {
	var total int64
	for _, h := range htmls {
		total += int64(utf8.RuneCountInString(htmlTagRe.ReplaceAllString(h, "")))
	}
	return total
}

// GetPublic 公开只读统计：仅安全字段，口径面向访客。
// 已发布文章数、已发布正文总字数（剥离 HTML 标签后的字符数近似）、
// 已通过审核评论数、运行天数（从最早记录到今天）。
func (s *StatsStore) GetPublic(ctx context.Context) (domainstats.PublicStats, error) {
	var stats domainstats.PublicStats

	// 已发布文章数
	if err := s.db.WithContext(ctx).
		Model(&newmodel.Post{}).
		Where("status = ?", "published").
		Count(&stats.PostsCount).Error; err != nil {
		return stats, domainshared.Internal("统计已发布文章数失败", err)
	}

	// 已发布正文总字数：剥离 HTML 标签后的字符数近似
	var htmls []string
	if err := s.db.WithContext(ctx).
		Model(&newmodel.Post{}).
		Where("status = ?", "published").
		Pluck("content_html", &htmls).Error; err != nil {
		return stats, domainshared.Internal("统计总字数失败", err)
	}
	stats.TotalWords = countStrippedChars(htmls)

	// 已通过审核评论数
	if err := s.db.WithContext(ctx).
		Model(&newmodel.Comment{}).
		Where("status = ?", "approved").
		Count(&stats.CommentsCount).Error; err != nil {
		return stats, domainshared.Internal("统计评论数失败", err)
	}

	// 运行天数：从最早 published 文章的 created_at 算到今天。
	// 取最早一行而非 MIN(created_at) 聚合——聚合会丢失列类型，SQLite 会把
	// 结果当字符串返回、无法扫描进 time.Time；读真实列在 SQLite/PostgreSQL 均可。
	var earliest newmodel.Post
	if err := s.db.WithContext(ctx).
		Model(&newmodel.Post{}).
		Where("status = ?", "published").
		Order("created_at ASC").
		Limit(1).
		Scan(&earliest).Error; err != nil {
		return stats, domainshared.Internal("查询建站时间失败", err)
	}
	if !earliest.CreatedAt.IsZero() {
		stats.UptimeDays = int64(time.Since(earliest.CreatedAt).Hours() / 24)
	}
	return stats, nil
}
