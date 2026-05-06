// Package handler 提供 HTTP 请求处理器，负责接收请求、验证参数、调用服务层并返回响应
package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"blog-api/internal/pkg/response"
	"blog-api/internal/service"
)

// AnnouncementHandler 公告处理器
type AnnouncementHandler struct {
	announcementService *service.AnnouncementService
}

// NewAnnouncementHandler 创建公告处理器实例
func NewAnnouncementHandler(announcementService *service.AnnouncementService) *AnnouncementHandler {
	return &AnnouncementHandler{
		announcementService: announcementService,
	}
}

// announcementResponse 公告响应
type announcementResponse struct {
	ID        int32  `json:"id"`
	Title     string `json:"title"`
	Content   string `json:"content"`
	Type      string `json:"type"`
	IsActive  bool   `json:"is_active"`
	StartTime string `json:"start_time,omitempty"`
	EndTime   string `json:"end_time,omitempty"`
	CreatedAt string `json:"created_at"`
}

// announcementDetailResponse 公告详情响应（管理员）
type announcementDetailResponse struct {
	ID        int32  `json:"id"`
	Title     string `json:"title"`
	Content   string `json:"content"`
	Type      string `json:"type"`
	IsActive  bool   `json:"is_active"`
	StartTime string `json:"start_time,omitempty"`
	EndTime   string `json:"end_time,omitempty"`
	CreatedBy string `json:"created_by,omitempty"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// ListActiveAnnouncements 获取生效的公告列表（公开接口）
// GET /api/v1/announcements
func (h *AnnouncementHandler) ListActiveAnnouncements(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "ListActiveAnnouncements").Msg("处理请求")

	announcements, err := h.announcementService.ListActiveAnnouncements(r.Context())
	if err != nil {
		log.Error().Err(err).Str("operation", "ListActiveAnnouncements").Msg("服务调用失败")
		response.InternalServerError(w, "查询公告失败")
		return
	}

	items := make([]announcementResponse, 0, len(announcements))
	for _, a := range announcements {
		var startTime, endTime string
		if a.StartTime.Valid {
			startTime = a.StartTime.Time.Format("2006-01-02T15:04:05Z07:00")
		}
		if a.EndTime.Valid {
			endTime = a.EndTime.Time.Format("2006-01-02T15:04:05Z07:00")
		}
		items = append(items, announcementResponse{
			ID:        a.ID,
			Title:     a.Title,
			Content:   a.Content,
			Type:      a.Type,
			IsActive:  a.IsActive,
			StartTime: startTime,
			EndTime:   endTime,
			CreatedAt: a.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}

	response.Success(w, map[string]interface{}{
		"announcements": items,
	})
	log.Info().Int("status", http.StatusOK).Int("count", len(items)).Msg("请求处理成功")
}

// ListAllAnnouncements 获取所有公告列表（管理接口）
// GET /api/v1/admin/announcements
func (h *AnnouncementHandler) ListAllAnnouncements(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "ListAllAnnouncements").Msg("处理请求")

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

	result, err := h.announcementService.ListAllAnnouncements(r.Context(), page, limit)
	if err != nil {
		log.Error().Err(err).Str("operation", "ListAllAnnouncements").Msg("服务调用失败")
		response.InternalServerError(w, "查询公告失败")
		return
	}

	items := make([]announcementDetailResponse, 0, len(result.Announcements))
	for _, a := range result.Announcements {
		var startTime, endTime, createdBy string
		if a.StartTime.Valid {
			startTime = a.StartTime.Time.Format("2006-01-02T15:04:05Z07:00")
		}
		if a.EndTime.Valid {
			endTime = a.EndTime.Time.Format("2006-01-02T15:04:05Z07:00")
		}
		if a.CreatedBy.Valid {
			createdBy = a.CreatedBy.UUID.String()
		}
		items = append(items, announcementDetailResponse{
			ID:        a.ID,
			Title:     a.Title,
			Content:   a.Content,
			Type:      a.Type,
			IsActive:  a.IsActive,
			StartTime: startTime,
			EndTime:   endTime,
			CreatedBy: createdBy,
			CreatedAt: a.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			UpdatedAt: a.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}

	response.Success(w, map[string]interface{}{
		"announcements": items,
		"total":         result.Total,
		"page":          result.Page,
		"limit":         result.Limit,
	})
	log.Info().Int("status", http.StatusOK).Int64("total", result.Total).Msg("请求处理成功")
}

// CreateAnnouncement 创建公告
// POST /api/v1/admin/announcements
func (h *AnnouncementHandler) CreateAnnouncement(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "CreateAnnouncement").Msg("处理请求")

	var req struct {
		Title     string     `json:"title" validate:"required"`
		Content   string     `json:"content" validate:"required"`
		Type      string     `json:"type" validate:"oneof=info warning success error"`
		IsActive  bool       `json:"is_active"`
		StartTime *time.Time `json:"start_time"`
		EndTime   *time.Time `json:"end_time"`
		CreatedBy string     `json:"created_by"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数解析失败")
		response.BadRequest(w, err.Error())
		return
	}

	if req.Title == "" || req.Content == "" {
		response.BadRequest(w, "标题和内容不能为空")
		return
	}

	if req.Type == "" {
		req.Type = "info"
	}

	var startTime, endTime sql.NullTime
	if req.StartTime != nil {
		startTime = sql.NullTime{Time: *req.StartTime, Valid: true}
	}
	if req.EndTime != nil {
		endTime = sql.NullTime{Time: *req.EndTime, Valid: true}
	}

	var createdBy uuid.NullUUID
	if req.CreatedBy != "" {
		uid, err := uuid.Parse(req.CreatedBy)
		if err == nil {
			createdBy = uuid.NullUUID{UUID: uid, Valid: true}
		}
	}

	announcement, err := h.announcementService.CreateAnnouncement(r.Context(), req.Title, req.Content, req.Type, req.IsActive, startTime, endTime, createdBy)
	if err != nil {
		log.Error().Err(err).Str("operation", "CreateAnnouncement").Msg("服务调用失败")
		response.InternalServerError(w, "创建公告失败")
		return
	}

	var st, et string
	if announcement.StartTime.Valid {
		st = announcement.StartTime.Time.Format("2006-01-02T15:04:05Z07:00")
	}
	if announcement.EndTime.Valid {
		et = announcement.EndTime.Time.Format("2006-01-02T15:04:05Z07:00")
	}
	var cb string
	if announcement.CreatedBy.Valid {
		cb = announcement.CreatedBy.UUID.String()
	}

	response.Success(w, announcementDetailResponse{
		ID:        announcement.ID,
		Title:     announcement.Title,
		Content:   announcement.Content,
		Type:      announcement.Type,
		IsActive:  announcement.IsActive,
		StartTime: st,
		EndTime:   et,
		CreatedBy: cb,
		CreatedAt: announcement.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt: announcement.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	})
	log.Info().Int("status", http.StatusOK).Int32("announcement_id", announcement.ID).Msg("请求处理成功")
}

// UpdateAnnouncement 更新公告
// PATCH /api/v1/admin/announcements/{id}
func (h *AnnouncementHandler) UpdateAnnouncement(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	log.Info().Str("handler", "UpdateAnnouncement").Str("id", idStr).Msg("处理请求")

	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		log.Warn().Err(err).Str("id", idStr).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "invalid_param", "无效的公告 ID")
		return
	}

	var req struct {
		Title     string     `json:"title"`
		Content   string     `json:"content"`
		Type      string     `json:"type"`
		IsActive  bool       `json:"is_active"`
		StartTime *time.Time `json:"start_time"`
		EndTime   *time.Time `json:"end_time"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数解析失败")
		response.BadRequest(w, err.Error())
		return
	}

	var startTime, endTime sql.NullTime
	if req.StartTime != nil {
		startTime = sql.NullTime{Time: *req.StartTime, Valid: true}
	}
	if req.EndTime != nil {
		endTime = sql.NullTime{Time: *req.EndTime, Valid: true}
	}

	announcement, err := h.announcementService.UpdateAnnouncement(r.Context(), int32(id), req.Title, req.Content, req.Type, req.IsActive, startTime, endTime)
	if err != nil {
		log.Error().Err(err).Str("operation", "UpdateAnnouncement").Int32("announcement_id", int32(id)).Msg("服务调用失败")
		response.InternalServerError(w, "更新公告失败")
		return
	}

	var st, et string
	if announcement.StartTime.Valid {
		st = announcement.StartTime.Time.Format("2006-01-02T15:04:05Z07:00")
	}
	if announcement.EndTime.Valid {
		et = announcement.EndTime.Time.Format("2006-01-02T15:04:05Z07:00")
	}

	response.Success(w, announcementDetailResponse{
		ID:        announcement.ID,
		Title:     announcement.Title,
		Content:   announcement.Content,
		Type:      announcement.Type,
		IsActive:  announcement.IsActive,
		StartTime: st,
		EndTime:   et,
		CreatedAt: announcement.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt: announcement.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	})
	log.Info().Int("status", http.StatusOK).Int32("announcement_id", int32(id)).Msg("请求处理成功")
}

// DeleteAnnouncement 删除公告
// DELETE /api/v1/admin/announcements/{id}
func (h *AnnouncementHandler) DeleteAnnouncement(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	log.Info().Str("handler", "DeleteAnnouncement").Str("id", idStr).Msg("处理请求")

	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		log.Warn().Err(err).Str("id", idStr).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "invalid_param", "无效的公告 ID")
		return
	}

	err = h.announcementService.DeleteAnnouncement(r.Context(), int32(id))
	if err != nil {
		log.Error().Err(err).Str("operation", "DeleteAnnouncement").Int32("announcement_id", int32(id)).Msg("服务调用失败")
		response.InternalServerError(w, "删除公告失败")
		return
	}

	response.Success(w, map[string]interface{}{
		"message": "公告删除成功",
	})
	log.Info().Int("status", http.StatusOK).Int32("announcement_id", int32(id)).Msg("请求处理成功")
}