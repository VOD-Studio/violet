// Package handler 提供 HTTP 请求处理器，负责接收请求、验证参数、调用服务层并返回响应
package handler

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"blog-api/internal/pkg/response"
	"blog-api/internal/service"
)

// AuditHandler 操作日志处理器
type AuditHandler struct {
	auditService *service.AuditService
}

// NewAuditHandler 创建操作日志处理器实例
func NewAuditHandler(auditService *service.AuditService) *AuditHandler {
	return &AuditHandler{
		auditService: auditService,
	}
}

// auditLogResponse 操作日志响应
type auditLogResponse struct {
	ID           int32  `json:"id"`
	UserID       string `json:"user_id,omitempty"`
	UserName     string `json:"user_name"`
	Action       string `json:"action"`
	ResourceType string `json:"resource_type"`
	ResourceID   string `json:"resource_id,omitempty"`
	ResourceName string `json:"resource_name,omitempty"`
	Detail       string `json:"detail,omitempty"`
	IPAddress    string `json:"ip_address,omitempty"`
	CreatedAt    string `json:"created_at"`
}

// ListLogs 获取操作日志列表
// GET /api/v1/admin/logs
func (h *AuditHandler) ListLogs(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "ListLogs").Msg("处理请求")

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

	result, err := h.auditService.ListLogs(r.Context(), page, limit)
	if err != nil {
		log.Error().Err(err).Str("operation", "ListLogs").Msg("服务调用失败")
		response.InternalServerError(w, "查询操作日志失败")
		return
	}

	items := make([]auditLogResponse, 0, len(result.Logs))
	for _, l := range result.Logs {
		userID := ""
		if l.UserID.Valid {
			userID = l.UserID.UUID.String()
		}
		items = append(items, auditLogResponse{
			ID:           l.ID,
			UserID:       userID,
			UserName:     l.UserName.String,
			Action:       l.Action,
			ResourceType: l.ResourceType,
			ResourceID:   l.ResourceID.String,
			ResourceName: l.ResourceName.String,
			Detail:       l.Detail.String,
			IPAddress:    l.IpAddress.String,
			CreatedAt:    l.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}

	response.Success(w, map[string]interface{}{
		"logs":  items,
		"total": result.Total,
		"page":  result.Page,
		"limit": result.Limit,
	})
	log.Info().Int("status", http.StatusOK).Int64("total", result.Total).Msg("请求处理成功")
}

// ListLogsByUser 查询指定用户的操作日志
// GET /api/v1/admin/logs/user/{id}
func (h *AuditHandler) ListLogsByUser(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	log.Info().Str("handler", "ListLogsByUser").Str("id", idStr).Msg("处理请求")

	userID, err := uuid.Parse(idStr)
	if err != nil {
		log.Warn().Err(err).Str("id", idStr).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "invalid_param", "无效的用户 ID")
		return
	}

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

	result, err := h.auditService.ListLogsByUser(r.Context(), userID, page, limit)
	if err != nil {
		log.Error().Err(err).Str("operation", "ListLogsByUser").Str("user_id", idStr).Msg("服务调用失败")
		response.InternalServerError(w, "查询用户操作日志失败")
		return
	}

	items := make([]auditLogResponse, 0, len(result.Logs))
	for _, l := range result.Logs {
		items = append(items, auditLogResponse{
			ID:           l.ID,
			UserID:       userID.String(),
			UserName:     l.UserName.String,
			Action:       l.Action,
			ResourceType: l.ResourceType,
			ResourceID:   l.ResourceID.String,
			ResourceName: l.ResourceName.String,
			Detail:       l.Detail.String,
			IPAddress:    l.IpAddress.String,
			CreatedAt:    l.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}

	response.Success(w, map[string]interface{}{
		"logs":  items,
		"total": result.Total,
		"page":  result.Page,
		"limit": result.Limit,
	})
	log.Info().Int("status", http.StatusOK).Str("user_id", idStr).Msg("请求处理成功")
}