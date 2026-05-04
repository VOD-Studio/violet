// Package handler 提供 HTTP 请求处理器，负责接收请求、验证参数、调用服务层并返回响应
package handler

import (
	"net/http"

	"github.com/rs/zerolog/log"

	"blog-api/internal/service"
)

// AdminHandler 后台管理接口处理器
type AdminHandler struct {
	// statsService 统计服务
	statsService *service.StatsService
}

// NewAdminHandler 创建后台管理处理器实例
func NewAdminHandler(statsService *service.StatsService) *AdminHandler {
	return &AdminHandler{
		statsService: statsService,
	}
}

// GetDashboardStats 后台总览统计
// GET /api/v1/admin/stats
// 需要管理员认证，返回文章、评论、用户等各项统计数据以及最近文章和热门文章
func (h *AdminHandler) GetDashboardStats(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "GetDashboardStats").Msg("处理请求")

	stats, err := h.statsService.GetDashboardStats(r.Context())
	if err != nil {
		log.Error().Err(err).Str("operation", "GetDashboardStats").Msg("服务调用失败")
		writeError(w, http.StatusInternalServerError, "internal_error", "获取统计数据失败")
		return
	}

	writeJSON(w, http.StatusOK, stats)
	log.Info().Int("status", http.StatusOK).Msg("请求处理成功")
}

// GetViewTrends 浏览量趋势
// GET /api/v1/admin/stats/views
// 需要管理员认证，返回最近 30 天每日浏览量和最近 12 个月每月浏览量
func (h *AdminHandler) GetViewTrends(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "GetViewTrends").Msg("处理请求")

	trends, err := h.statsService.GetViewTrends(r.Context())
	if err != nil {
		log.Error().Err(err).Str("operation", "GetViewTrends").Msg("服务调用失败")
		writeError(w, http.StatusInternalServerError, "internal_error", "获取浏览量趋势失败")
		return
	}

	writeJSON(w, http.StatusOK, trends)
	log.Info().Int("status", http.StatusOK).Msg("请求处理成功")
}
