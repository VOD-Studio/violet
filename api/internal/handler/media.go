package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"blog-api/internal/middleware"
	"blog-api/internal/service"
)

// MediaHandler 媒体管理接口处理器
type MediaHandler struct {
	mediaService    *service.MediaService
	downloadService *service.DownloadService
	uploadDir       string
}

// NewMediaHandler 创建媒体管理处理器实例
func NewMediaHandler(mediaService *service.MediaService, downloadService *service.DownloadService, uploadDir string) *MediaHandler {
	return &MediaHandler{
		mediaService:    mediaService,
		downloadService: downloadService,
		uploadDir:       uploadDir,
	}
}

// GetMedia 获取媒体详情
// GET /api/media/:id
func (h *MediaHandler) GetMedia(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "无效的媒体 ID")
		return
	}

	media, err := h.mediaService.GetMediaByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, service.ErrMediaNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "媒体不存在")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "查询媒体失败")
		return
	}

	writeJSON(w, http.StatusOK, media)
}

// ListMedia 媒体列表
// GET /api/media
// 支持分页和类型筛选
func (h *MediaHandler) ListMedia(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	mimeType := r.URL.Query().Get("type")

	result, err := h.mediaService.ListMedia(r.Context(), page, limit, mimeType)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "查询媒体列表失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"media": result.Media,
		"total": result.Total,
		"page":  result.Page,
		"limit": result.Limit,
	})
}

// UpdateMedia 更新媒体信息
// PATCH /api/media/:id
func (h *MediaHandler) UpdateMedia(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "无效的媒体 ID")
		return
	}

	var req service.UpdateMediaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	media, err := h.mediaService.UpdateMedia(r.Context(), id, req)
	if err != nil {
		if errors.Is(err, service.ErrMediaNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "媒体不存在")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "更新媒体失败")
		return
	}

	writeJSON(w, http.StatusOK, media)
}

// DeleteMedia 删除媒体
// DELETE /api/media/:id
func (h *MediaHandler) DeleteMedia(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "无效的媒体 ID")
		return
	}

	if err := h.mediaService.DeleteMedia(r.Context(), id); err != nil {
		if errors.Is(err, service.ErrMediaNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "媒体不存在")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "删除媒体失败")
		return
	}

	writeJSON(w, http.StatusOK, MessageResponse{
		Message: "媒体已删除",
	})
}

// Download 下载媒体文件
// GET /api/media/{id}/download
// 通过 downloadService 校验权限并记录下载
func (h *MediaHandler) Download(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "无效的媒体 ID")
		return
	}

	userID := middleware.GetUserID(r.Context())

	media, err := h.downloadService.CheckDownloadPermission(r.Context(), userID, id)
	if err != nil {
		if errors.Is(err, service.ErrMediaNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "媒体不存在")
			return
		}
		if errors.Is(err, service.ErrDownloadPermissionDenied) {
			writeError(w, http.StatusForbidden, "forbidden", "无权下载此文件")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "检查下载权限失败")
		return
	}

	filePath := filepath.Join(h.uploadDir, media.Filename)
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		writeError(w, http.StatusNotFound, "not_found", "文件不存在")
		return
	}

	// 记录下载
	go h.downloadService.RecordDownload(context.Background(), id, userID)

	w.Header().Set("Content-Disposition", "attachment; filename=\""+media.OriginalName+"\"")
	w.Header().Set("Content-Type", media.MimeType)
	http.ServeFile(w, r, filePath)
}

// DownloadFile 下载文件
// GET /api/files/:id/download
// 支持权限控制：public 任何人可下载，user 需要登录，admin 需要管理员权限
func (h *MediaHandler) DownloadFile(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "无效的文件 ID")
		return
	}

	// 获取用户角色（未登录为空字符串）
	userRole := middleware.GetUserRole(r.Context())

	// 检查下载权限
	media, err := h.mediaService.CheckDownloadPermission(r.Context(), id, userRole)
	if err != nil {
		if errors.Is(err, service.ErrMediaNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "文件不存在")
			return
		}
		if errors.Is(err, service.ErrDownloadForbidden) {
			writeError(w, http.StatusForbidden, "forbidden", "无权下载此文件")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "检查权限失败")
		return
	}

	// 查找文件
	filePath := filepath.Join(h.uploadDir, media.Filename)
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		writeError(w, http.StatusNotFound, "not_found", "文件不存在")
		return
	}

	// 增加下载计数
	go h.mediaService.IncrementDownloadCount(r.Context(), id)

	// 设置下载响应头
	w.Header().Set("Content-Disposition", "attachment; filename=\""+media.OriginalName+"\"")
	w.Header().Set("Content-Type", media.MimeType)
	http.ServeFile(w, r, filePath)
}
