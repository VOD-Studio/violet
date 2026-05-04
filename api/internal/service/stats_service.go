package service

import (
	"context"
	"fmt"

	"github.com/rs/zerolog/log"

	"blog-api/internal/repository/generated"
)

// DashboardStats 后台总览统计数据
type DashboardStats struct {
	// TotalPosts 文章总数
	TotalPosts int64 `json:"totalPosts"`
	// TotalComments 评论总数
	TotalComments int64 `json:"totalComments"`
	// PendingComments 待审核评论数
	PendingComments int64 `json:"pendingComments"`
	// TotalViews 总浏览量
	TotalViews int64 `json:"totalViews"`
	// TotalUsers 用户总数
	TotalUsers int64 `json:"totalUsers"`
	// RecentPosts 最近文章列表
	RecentPosts []*RecentPost `json:"recentPosts"`
	// PopularPosts 热门文章列表
	PopularPosts []*PopularPost `json:"popularPosts"`
}

// RecentPost 最近文章摘要
type RecentPost struct {
	// ID 文章 ID
	ID string `json:"id"`
	// Title 文章标题
	Title string `json:"title"`
	// Slug URL 标识符
	Slug string `json:"slug"`
	// Status 文章状态
	Status string `json:"status"`
	// ViewCount 浏览次数
	ViewCount int32 `json:"viewCount"`
	// PublishedAt 发布时间
	PublishedAt *string `json:"publishedAt,omitempty"`
}

// PopularPost 门文章摘要
type PopularPost struct {
	// ID 文章 ID
	ID string `json:"id"`
	// Title 文章标题
	Title string `json:"title"`
	// Slug URL 标识符
	Slug string `json:"slug"`
	// ViewCount 浏览次数
	ViewCount int32 `json:"viewCount"`
}

// ViewTrends 浏览量趋势数据
type ViewTrends struct {
	// Daily 最近 30 天每日浏览量
	Daily []*DailyView `json:"daily"`
	// Monthly 最近 12 个月每月浏览量
	Monthly []*MonthlyView `json:"monthly"`
}

// DailyView 每日浏览量
type DailyView struct {
	// Date 日期，格式为 YYYY-MM-DD
	Date string `json:"date"`
	// Count 浏览次数
	Count int64 `json:"count"`
}

// MonthlyView 每月浏览量
type MonthlyView struct {
	// Month 月份，格式为 YYYY-MM
	Month string `json:"month"`
	// Count 浏览次数
	Count int64 `json:"count"`
}

// StatsService 统计业务服务
type StatsService struct {
	queries *generated.Queries
}

// NewStatsService 创建统计服务实例
func NewStatsService(queries *generated.Queries) *StatsService {
	return &StatsService{queries: queries}
}

// GetDashboardStats 获取后台总览统计数据
func (s *StatsService) GetDashboardStats(ctx context.Context) (*DashboardStats, error) {
	log.Info().Str("service", "StatsService").Str("operation", "GetDashboardStats").Msg("开始获取后台统计数据")

	// 并发查询各项统计数据
	log.Debug().Str("query", "CountTotalPosts").Msg("统计文章总数")
	totalPosts, err := s.queries.CountTotalPosts(ctx)
	if err != nil {
		log.Error().Err(err).Msg("统计文章总数失败")
		return nil, fmt.Errorf("统计文章总数失败: %w", err)
	}

	log.Debug().Str("query", "CountTotalComments").Msg("统计评论总数")
	totalComments, err := s.queries.CountTotalComments(ctx)
	if err != nil {
		log.Error().Err(err).Msg("统计评论总数失败")
		return nil, fmt.Errorf("统计评论总数失败: %w", err)
	}

	log.Debug().Str("query", "CountAllPendingComments").Msg("统计待审核评论数")
	pendingComments, err := s.queries.CountAllPendingComments(ctx)
	if err != nil {
		log.Error().Err(err).Msg("统计待审核评论数失败")
		return nil, fmt.Errorf("统计待审核评论数失败: %w", err)
	}

	log.Debug().Str("query", "CountTotalViews").Msg("统计总浏览量")
	totalViews, err := s.queries.CountTotalViews(ctx)
	if err != nil {
		log.Error().Err(err).Msg("统计总浏览量失败")
		return nil, fmt.Errorf("统计总浏览量失败: %w", err)
	}

	log.Debug().Str("query", "CountTotalUsers").Msg("统计用户总数")
	totalUsers, err := s.queries.CountTotalUsers(ctx)
	if err != nil {
		log.Error().Err(err).Msg("统计用户总数失败")
		return nil, fmt.Errorf("统计用户总数失败: %w", err)
	}

	// 查询最近文章
	log.Debug().Str("query", "GetRecentPosts").Msg("查询最近文章")
	recentRows, err := s.queries.GetRecentPosts(ctx)
	if err != nil {
		log.Error().Err(err).Msg("查询最近文章失败")
		return nil, fmt.Errorf("查询最近文章失败: %w", err)
	}
	recentPosts := make([]*RecentPost, len(recentRows))
	for i, row := range recentRows {
		recentPosts[i] = &RecentPost{
			ID:        row.ID.String(),
			Title:     row.Title,
			Slug:      row.Slug,
			Status:    row.Status,
			ViewCount: row.ViewCount,
		}
	}

	// 查询热门文章
	log.Debug().Str("query", "GetPopularPosts").Msg("查询热门文章")
	popularRows, err := s.queries.GetPopularPosts(ctx)
	if err != nil {
		log.Error().Err(err).Msg("查询热门文章失败")
		return nil, fmt.Errorf("查询热门文章失败: %w", err)
	}
	popularPosts := make([]*PopularPost, len(popularRows))
	for i, row := range popularRows {
		popularPosts[i] = &PopularPost{
			ID:        row.ID.String(),
			Title:     row.Title,
			Slug:      row.Slug,
			ViewCount: row.ViewCount,
		}
	}

	log.Info().Int64("posts", totalPosts).Int64("comments", totalComments).
		Int64("views", totalViews).Msg("后台统计数据获取成功")
	return &DashboardStats{
		TotalPosts:      totalPosts,
		TotalComments:   totalComments,
		PendingComments: pendingComments,
		TotalViews:      totalViews,
		TotalUsers:      totalUsers,
		RecentPosts:     recentPosts,
		PopularPosts:    popularPosts,
	}, nil
}

// GetViewTrends 获取浏览量趋势数据
func (s *StatsService) GetViewTrends(ctx context.Context) (*ViewTrends, error) {
	log.Info().Str("service", "StatsService").Str("operation", "GetViewTrends").Msg("开始获取浏览量趋势")

	// 查询最近 30 天每日浏览量
	log.Debug().Str("query", "GetDailyViews").Msg("查询每日浏览量")
	dailyRows, err := s.queries.GetDailyViews(ctx)
	if err != nil {
		log.Error().Err(err).Msg("查询每日浏览量失败")
		return nil, fmt.Errorf("查询每日浏览量失败: %w", err)
	}
	daily := make([]*DailyView, len(dailyRows))
	for i, row := range dailyRows {
		daily[i] = &DailyView{
			Date:  row.Date.Format("2006-01-02"),
			Count: row.Views,
		}
	}

	// 查询最近 12 个月每月浏览量
	log.Debug().Str("query", "GetMonthlyViews").Msg("查询每月浏览量")
	monthlyRows, err := s.queries.GetMonthlyViews(ctx)
	if err != nil {
		log.Error().Err(err).Msg("查询每月浏览量失败")
		return nil, fmt.Errorf("查询每月浏览量失败: %w", err)
	}
	monthly := make([]*MonthlyView, len(monthlyRows))
	for i, row := range monthlyRows {
		monthly[i] = &MonthlyView{
			Month: row.Month,
			Count: row.Views,
		}
	}

	log.Info().Int("daily_count", len(daily)).Int("monthly_count", len(monthly)).Msg("浏览量趋势获取成功")
	return &ViewTrends{
		Daily:   daily,
		Monthly: monthly,
	}, nil
}
