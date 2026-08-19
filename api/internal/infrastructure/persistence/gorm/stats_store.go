// Package gorm 提供 stats 模块的 GORM 存储实现。
package gorm

import (
	"context"
	"regexp"
	"sort"
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

	// 对比口径窗口边界（本地时区）：今日/昨日自然日、本周/上周（周一起算）。
	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	yesterdayStart := todayStart.AddDate(0, 0, -1)
	mondayStart := todayStart.AddDate(0, 0, -((int(now.Weekday())+6)%7))
	lastMondayStart := mondayStart.AddDate(0, 0, -7)
	if err := s.db.WithContext(ctx).Model(&newmodel.PostView{}).
		Where("created_at >= ?", todayStart).Count(&stats.TodayViews).Error; err != nil {
		return stats, domainshared.Internal("统计今日浏览量失败", err)
	}
	if err := s.db.WithContext(ctx).Model(&newmodel.PostView{}).
		Where("created_at >= ? AND created_at < ?", yesterdayStart, todayStart).Count(&stats.YesterdayViews).Error; err != nil {
		return stats, domainshared.Internal("统计昨日浏览量失败", err)
	}
	if err := s.db.WithContext(ctx).Model(&newmodel.Comment{}).
		Where("created_at >= ?", mondayStart).Count(&stats.WeekComments).Error; err != nil {
		return stats, domainshared.Internal("统计本周评论数失败", err)
	}
	if err := s.db.WithContext(ctx).Model(&newmodel.Comment{}).
		Where("created_at >= ? AND created_at < ?", lastMondayStart, mondayStart).Count(&stats.LastWeekComments).Error; err != nil {
		return stats, domainshared.Internal("统计上周评论数失败", err)
	}

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

func (s *StatsStore) GetViewTrends(ctx context.Context, days int) (domainstats.ViewTrends, error) {
	var trends domainstats.ViewTrends
	// 拉取最近 12 个月原始浏览事件，日/月两个口径在应用层分桶共享同一批行。
	// 应用层聚合而非 SQL TO_CHAR：后者是 PostgreSQL 专属函数，会让 SQLite
	// 集成测试失败；分桶统一走本地时区，双后端口径一致（对齐 countStrippedChars 先例）。
	now := time.Now()
	monthFrom := now.AddDate(-1, 0, 0)
	dayFrom := now.AddDate(0, 0, -days)
	var rows []struct{ CreatedAt time.Time }
	if err := s.db.WithContext(ctx).
		Model(&newmodel.PostView{}).
		Select("created_at").
		Where("created_at >= ?", monthFrom).
		Scan(&rows).Error; err != nil {
		return trends, domainshared.Internal("查询浏览趋势失败", err)
	}
	dailyBuckets := make(map[string]int64)
	monthlyBuckets := make(map[string]int64)
	for _, r := range rows {
		local := r.CreatedAt.In(time.Local)
		if !local.Before(dayFrom) {
			dailyBuckets[local.Format("2006-01-02")]++
		}
		monthlyBuckets[local.Format("2006-01")]++
	}
	trends.Daily = sortedViewPoints(dailyBuckets)
	trends.Monthly = sortedViewPoints(monthlyBuckets)
	return trends, nil
}

// sortedViewPoints 按 Label 升序输出分桶结果，保证时间轴单调。
func sortedViewPoints(buckets map[string]int64) []domainstats.ViewPoint {
	points := make([]domainstats.ViewPoint, 0, len(buckets))
	for label, count := range buckets {
		points = append(points, domainstats.ViewPoint{Label: label, Count: count})
	}
	sort.Slice(points, func(i, j int) bool { return points[i].Label < points[j].Label })
	return points
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
