// Package handler 提供 HTTP 请求处理器，负责接收请求、验证参数、调用服务层并返回响应
package handler

import (
	"github.com/rs/zerolog/log"

	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"blog-api/internal/model"
	"blog-api/internal/pkg/response"
	"blog-api/internal/service"
)

// MediaHandler 媒体管理接口处理器
type MediaHandler struct {
	fileService *service.FileService
	uploadDir   string
}

// NewMediaHandler 创建媒体管理处理器实例
func NewMediaHandler(fileService *service.FileService, uploadDir string) *MediaHandler {
	return &MediaHandler{
		fileService: fileService,
		uploadDir:   uploadDir,
	}
}

// GetMedia 获取媒体详情
// GET /api/v1/media/:id
func (h *MediaHandler) GetMedia(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "GetMedia").Msg("处理请求")

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		log.Warn().Err(err).Str("media_id", idStr).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "invalid_param", "无效的媒体 ID")
		return
	}

	file, err := h.fileService.FindByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, service.ErrFileNotFound) {
			log.Warn().Str("media_id", id.String()).Msg("媒体不存在")
			response.NotFound(w, "媒体不存在")
			return
		}
		log.Error().Err(err).Str("operation", "FindByID").Str("media_id", id.String()).Msg("服务调用失败")
		response.InternalServerError(w, "查询媒体失败")
		return
	}

	log.Info().Int("status", http.StatusOK).Str("media_id", id.String()).Msg("请求处理成功")
	response.Success(w, fileToMediaItem(file))
}

// ListMedia 媒体列表
// GET /api/v1/media
// 支持分页和类型筛选
func (h *MediaHandler) ListMedia(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "ListMedia").Msg("处理请求")

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	mimeType := r.URL.Query().Get("type")

	result, err := h.fileService.List(r.Context(), page, limit, mimeType)
	if err != nil {
		log.Error().Err(err).Str("operation", "List").Int("page", page).Int("limit", limit).Msg("服务调用失败")
		response.InternalServerError(w, "查询媒体列表失败")
		return
	}

	items := make([]mediaItem, 0, len(result.Files))
	for _, f := range result.Files {
		items = append(items, fileToMediaItem(&f))
	}

	log.Info().Int("status", http.StatusOK).Int("count", len(items)).Int("page", page).Msg("请求处理成功")
	response.Success(w, map[string]interface{}{
		"media": items,
		"total": result.Total,
		"page":  result.Page,
		"limit": result.Limit,
	})
}

// DeleteMedia 删除媒体（软删除）
// DELETE /api/v1/media/:id
func (h *MediaHandler) DeleteMedia(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "DeleteMedia").Msg("处理请求")

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		log.Warn().Err(err).Str("media_id", idStr).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "invalid_param", "无效的媒体 ID")
		return
	}

	if err := h.fileService.SoftDelete(r.Context(), id); err != nil {
		if errors.Is(err, service.ErrFileNotFound) {
			log.Warn().Str("media_id", id.String()).Msg("媒体不存在")
			response.NotFound(w, "媒体不存在")
			return
		}
		log.Error().Err(err).Str("operation", "SoftDelete").Str("media_id", id.String()).Msg("服务调用失败")
		response.InternalServerError(w, "删除媒体失败")
		return
	}

	log.Info().Int("status", http.StatusOK).Str("media_id", id.String()).Msg("请求处理成功")
	response.Success(w, MessageResponse{
		Message: "媒体已删除",
	})
}

// BatchDeleteMedia 批量删除媒体（软删除）
// POST /api/v1/media/batch-delete
func (h *MediaHandler) BatchDeleteMedia(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "BatchDeleteMedia").Msg("处理请求")

	var req struct {
		IDs []string `json:"ids"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		response.BadRequest(w, err.Error())
		return
	}

	if len(req.IDs) == 0 {
		log.Warn().Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "validation_error", "请选择要删除的文件")
		return
	}

	ids := make([]uuid.UUID, 0, len(req.IDs))
	for _, idStr := range req.IDs {
		id, err := uuid.Parse(idStr)
		if err != nil {
			continue
		}
		ids = append(ids, id)
	}

	if len(ids) == 0 {
		log.Warn().Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "validation_error", "无效的媒体 ID")
		return
	}

	count, err := h.fileService.BatchSoftDelete(r.Context(), ids)
	if err != nil {
		log.Error().Err(err).Str("operation", "BatchSoftDelete").Int("count", len(ids)).Msg("服务调用失败")
		response.InternalServerError(w, "批量删除失败")
		return
	}

	log.Info().Int("status", http.StatusOK).Int("deleted_count", int(count)).Msg("请求处理成功")
	response.Success(w, map[string]interface{}{
		"message": "批量删除成功",
		"count":   count,
	})
}

// UploadThumbnail 上传视频封面缩略图
// POST /api/v1/media/:id/thumbnail
// 接收 JPEG 图片，保存并更新 files 表的 thumbnail 字段
func (h *MediaHandler) UploadThumbnail(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "UploadThumbnail").Msg("处理请求")

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		log.Warn().Err(err).Str("media_id", idStr).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "invalid_param", "无效的媒体 ID")
		return
	}

	file, err := h.fileService.FindByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, service.ErrFileNotFound) {
			log.Warn().Str("media_id", id.String()).Msg("媒体不存在")
			response.NotFound(w, "媒体不存在")
			return
		}
		log.Error().Err(err).Str("operation", "FindByID").Str("media_id", id.String()).Msg("服务调用失败")
		response.InternalServerError(w, "查询媒体失败")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 10*1024*1024)
	if err := r.ParseMultipartForm(10 * 1024 * 1024); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "file_too_large", "缩略图大小不能超过 10 MB")
		return
	}

	thumbFile, _, err := r.FormFile("thumbnail")
	if err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "invalid_file", "缺少缩略图文件")
		return
	}
	defer thumbFile.Close()

	// 缩略图文件名: {uuid}_thumb.jpg，保存到与原文件相同的目录
	thumbName := file.ID.String() + "_thumb.jpg"
	// 从文件 Path 推导存储目录（如 uploads/material/video/xxx.jpg → uploads/material/video）
	storageDir := filepath.Dir(file.Path)
	thumbPath := filepath.Join(storageDir, thumbName)

	// 确保目录存在
	thumbDir := filepath.Dir(thumbPath)
	if err := os.MkdirAll(thumbDir, 0755); err != nil {
		log.Error().Err(err).Str("path", thumbDir).Msg("创建目录失败")
		response.InternalServerError(w, "保存缩略图失败")
		return
	}

	dst, err := os.Create(thumbPath)
	if err != nil {
		log.Error().Err(err).Str("path", thumbPath).Msg("创建文件失败")
		response.InternalServerError(w, "保存缩略图失败")
		return
	}
	defer dst.Close()

	if _, err := dst.ReadFrom(thumbFile); err != nil {
		log.Error().Err(err).Str("path", thumbPath).Msg("写入文件失败")
		response.InternalServerError(w, "写入缩略图失败")
		return
	}

	// 构建 thumbnail URL 并更新数据库
	thumbnailURL := "/" + thumbPath
	if err := h.fileService.UpdateThumbnail(r.Context(), id, thumbnailURL); err != nil {
		log.Error().Err(err).Str("operation", "UpdateThumbnail").Str("media_id", id.String()).Msg("服务调用失败")
		response.InternalServerError(w, "更新缩略图失败")
		return
	}

	log.Info().Int("status", http.StatusOK).Str("media_id", id.String()).Str("thumbnail_url", thumbnailURL).Msg("请求处理成功")
	response.Success(w, map[string]interface{}{
		"message":   "缩略图上传成功",
		"thumbnail": thumbnailURL,
	})
}

// mediaItem 前端兼容的媒体响应结构
type mediaItem struct {
	ID           string `json:"id"`
	URL          string `json:"path"`
	OriginalName string `json:"original_name"`
	MimeType     string `json:"mime_type"`
	Size         int64  `json:"size"`
	Thumbnail    string `json:"thumbnail,omitempty"`
	Width        *int   `json:"width,omitempty"`
	Height       *int   `json:"height,omitempty"`
	CreatedAt    string `json:"created_at"`
}

// fileToMediaItem 将 File 模型转换为前端兼容的 mediaItem
func fileToMediaItem(f *model.File) mediaItem {
	return mediaItem{
		ID:           f.ID.String(),
		URL:          f.URL,
		OriginalName: f.OriginalName,
		MimeType:     f.MimeType,
		Size:         f.Size,
		Thumbnail:    f.Thumbnail,
		Width:        f.Width,
		Height:       f.Height,
		CreatedAt:    f.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}
