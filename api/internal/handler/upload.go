// Package handler 提供 HTTP 请求处理器，负责接收请求、验证参数、调用服务层并返回响应
package handler

import (
	"github.com/rs/zerolog/log"

	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"blog-api/internal/middleware"
	"blog-api/internal/service"
)

// UploadHandler 分片上传接口处理器
type UploadHandler struct {
	// uploadService 分片上传业务服务
	uploadService *service.UploadService
}

// NewUploadHandler 创建分片上传处理器实例
func NewUploadHandler(uploadService *service.UploadService) *UploadHandler {
	return &UploadHandler{
		uploadService: uploadService,
	}
}

// InitSession 初始化上传会话
// POST /api/v1/upload/init
// 需要认证，支持秒传检查和断点续传恢复
func (h *UploadHandler) InitSession(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "InitSession").Msg("处理请求")

	// 从上下文获取当前用户 ID
	userIDStr := middleware.GetUserID(r.Context())
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		log.Warn().Err(err).Str("user_id", userIDStr).Msg("参数验证失败")
		writeError(w, http.StatusUnauthorized, "unauthorized", "无效的用户身份")
		return
	}

	// 解析请求体
	var req service.InitSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	// 参数校验
	if req.FileName == "" {
		log.Warn().Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "validation_error", "文件名为必填项")
		return
	}
	if req.FileSize <= 0 {
		log.Warn().Int64("file_size", req.FileSize).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "validation_error", "文件大小必须大于 0")
		return
	}

	// 调用服务层初始化上传会话
	result, err := h.uploadService.InitSession(r.Context(), userID, req)
	if err != nil {
		if errors.Is(err, service.ErrInvalidImageType) {
			log.Warn().Err(err).Str("file_name", req.FileName).Msg("参数验证失败")
			writeError(w, http.StatusBadRequest, "invalid_type", "不支持的文件类型")
			return
		}
		if errors.Is(err, service.ErrImageTooLarge) {
			log.Warn().Err(err).Int64("file_size", req.FileSize).Msg("参数验证失败")
			writeError(w, http.StatusBadRequest, "file_too_large", "文件大小超过限制")
			return
		}
		log.Error().Err(err).Str("operation", "InitSession").Msg("服务调用失败")
		writeError(w, http.StatusInternalServerError, "internal_error", "初始化上传失败")
		return
	}

	log.Info().Int("status", http.StatusOK).Str("file_name", req.FileName).Msg("请求处理成功")
	writeJSON(w, http.StatusOK, result)
}

// SaveChunk 上传单个分片
// PUT /api/v1/upload/{uploadId}/chunk/{index}
// 需要认证，将分片数据写入临时目录
func (h *UploadHandler) SaveChunk(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "SaveChunk").Msg("处理请求")

	// 从 URL 获取上传会话 ID
	uploadIDStr := chi.URLParam(r, "uploadId")
	if uploadIDStr == "" {
		log.Warn().Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "invalid_param", "缺少 uploadId")
		return
	}
	uploadID, err := uuid.Parse(uploadIDStr)
	if err != nil {
		log.Warn().Err(err).Str("upload_id", uploadIDStr).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "invalid_param", "无效的 uploadId")
		return
	}

	// 从 URL 获取分片索引
	indexStr := chi.URLParam(r, "index")
	if indexStr == "" {
		log.Warn().Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "invalid_param", "缺少分片索引")
		return
	}
	index, err := strconv.Atoi(indexStr)
	if err != nil {
		log.Warn().Err(err).Str("index", indexStr).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "invalid_param", "无效的分片索引")
		return
	}

	// 读取请求体作为分片数据（限制 50MB）
	r.Body = http.MaxBytesReader(w, r.Body, 50*1024*1024)

	// 调用服务层保存分片
	if err := h.uploadService.SaveChunk(r.Context(), uploadID, index, r.Body); err != nil {
		if errors.Is(err, service.ErrUploadNotFound) {
			log.Warn().Str("upload_id", uploadID.String()).Msg("上传任务不存在")
			writeError(w, http.StatusNotFound, "not_found", "上传任务不存在")
			return
		}
		if errors.Is(err, service.ErrSessionNotActive) {
			log.Warn().Str("upload_id", uploadID.String()).Msg("上传会话不在活跃状态")
			writeError(w, http.StatusBadRequest, "not_active", "上传会话不在活跃状态")
			return
		}
		if errors.Is(err, service.ErrChunkAlreadyExists) {
			// 分片已存在，视为成功（幂等）
			log.Info().Str("upload_id", uploadID.String()).Int("index", index).Msg("分片已存在")
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"message":   "分片已存在",
				"uploadId":  uploadIDStr,
				"index":     index,
			})
			return
		}
		log.Error().Err(err).Str("operation", "SaveChunk").Str("upload_id", uploadID.String()).Int("index", index).Msg("服务调用失败")
		writeError(w, http.StatusInternalServerError, "internal_error", "上传分片失败")
		return
	}

	log.Info().Int("status", http.StatusOK).Str("upload_id", uploadID.String()).Int("index", index).Msg("请求处理成功")
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":   "分片上传成功",
		"uploadId":  uploadIDStr,
		"index":     index,
	})
}

// CompleteUpload 合并所有分片为完整文件
// POST /api/v1/upload/{uploadId}/complete
// 需要认证，验证所有分片完整性后合并
func (h *UploadHandler) CompleteUpload(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "CompleteUpload").Msg("处理请求")

	// 从 URL 获取上传会话 ID
	uploadIDStr := chi.URLParam(r, "uploadId")
	if uploadIDStr == "" {
		log.Warn().Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "invalid_param", "缺少 uploadId")
		return
	}
	uploadID, err := uuid.Parse(uploadIDStr)
	if err != nil {
		log.Warn().Err(err).Str("upload_id", uploadIDStr).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "invalid_param", "无效的 uploadId")
		return
	}

	// 从上下文获取当前用户 ID
	userIDStr := middleware.GetUserID(r.Context())
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		log.Warn().Err(err).Str("user_id", userIDStr).Msg("参数验证失败")
		writeError(w, http.StatusUnauthorized, "unauthorized", "无效的用户身份")
		return
	}

	// 调用服务层合并分片
	result, err := h.uploadService.MergeChunks(r.Context(), uploadID, userID)
	if err != nil {
		if errors.Is(err, service.ErrUploadNotFound) {
			log.Warn().Str("upload_id", uploadID.String()).Msg("上传任务不存在")
			writeError(w, http.StatusNotFound, "not_found", "上传任务不存在")
			return
		}
		if errors.Is(err, service.ErrUploadIncomplete) {
			log.Warn().Str("upload_id", uploadID.String()).Msg("分片上传未完成")
			writeError(w, http.StatusBadRequest, "incomplete", "分片上传未完成")
			return
		}
		if errors.Is(err, service.ErrHashMismatch) {
			log.Error().Str("upload_id", uploadID.String()).Msg("文件哈希校验失败")
			writeError(w, http.StatusBadRequest, "hash_mismatch", "文件哈希校验失败")
			return
		}
		if errors.Is(err, service.ErrSessionNotActive) {
			log.Warn().Str("upload_id", uploadID.String()).Msg("上传会话不在活跃状态")
			writeError(w, http.StatusBadRequest, "not_active", "上传会话不在活跃状态")
			return
		}
		log.Error().Err(err).Str("operation", "MergeChunks").Str("upload_id", uploadID.String()).Msg("服务调用失败")
		writeError(w, http.StatusInternalServerError, "internal_error", "合并文件失败")
		return
	}

	log.Info().Int("status", http.StatusOK).Str("upload_id", uploadID.String()).Str("file_url", result.URL).Msg("请求处理成功")
	writeJSON(w, http.StatusOK, result)
}

// CancelUpload 取消上传并清理临时分片
// DELETE /api/v1/upload/{uploadId}
// 需要认证，仅允许上传者取消
func (h *UploadHandler) CancelUpload(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "CancelUpload").Msg("处理请求")

	// 从 URL 获取上传会话 ID
	uploadIDStr := chi.URLParam(r, "uploadId")
	if uploadIDStr == "" {
		log.Warn().Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "invalid_param", "缺少 uploadId")
		return
	}
	uploadID, err := uuid.Parse(uploadIDStr)
	if err != nil {
		log.Warn().Err(err).Str("upload_id", uploadIDStr).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "invalid_param", "无效的 uploadId")
		return
	}

	// 从上下文获取当前用户 ID
	userIDStr := middleware.GetUserID(r.Context())
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		log.Warn().Err(err).Str("user_id", userIDStr).Msg("参数验证失败")
		writeError(w, http.StatusUnauthorized, "unauthorized", "无效的用户身份")
		return
	}

	// 调用服务层取消上传
	if err := h.uploadService.CancelUpload(r.Context(), uploadID, userID); err != nil {
		if errors.Is(err, service.ErrUploadNotFound) {
			log.Warn().Str("upload_id", uploadID.String()).Msg("上传任务不存在")
			writeError(w, http.StatusNotFound, "not_found", "上传任务不存在")
			return
		}
		if errors.Is(err, service.ErrSessionNotActive) {
			log.Warn().Str("upload_id", uploadID.String()).Msg("上传会话不在活跃状态")
			writeError(w, http.StatusBadRequest, "not_active", "上传会话不在活跃状态")
			return
		}
		log.Error().Err(err).Str("operation", "CancelUpload").Str("upload_id", uploadID.String()).Msg("服务调用失败")
		writeError(w, http.StatusInternalServerError, "internal_error", "取消上传失败")
		return
	}

	log.Info().Int("status", http.StatusOK).Str("upload_id", uploadID.String()).Msg("请求处理成功")
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message": "上传已取消",
	})
}

// GetUploadStatus 查询上传会话状态（用于断点续传）
// GET /api/v1/upload/{uploadId}/status
// 需要认证，返回会话详情和已上传分片列表
func (h *UploadHandler) GetUploadStatus(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "GetUploadStatus").Msg("处理请求")

	// 从 URL 获取上传会话 ID
	uploadIDStr := chi.URLParam(r, "uploadId")
	if uploadIDStr == "" {
		log.Warn().Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "invalid_param", "缺少 uploadId")
		return
	}
	uploadID, err := uuid.Parse(uploadIDStr)
	if err != nil {
		log.Warn().Err(err).Str("upload_id", uploadIDStr).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "invalid_param", "无效的 uploadId")
		return
	}

	// 调用服务层查询会话状态
	session, err := h.uploadService.GetSession(r.Context(), uploadID)
	if err != nil {
		if errors.Is(err, service.ErrUploadNotFound) {
			log.Warn().Str("upload_id", uploadID.String()).Msg("上传任务不存在")
			writeError(w, http.StatusNotFound, "not_found", "上传任务不存在")
			return
		}
		log.Error().Err(err).Str("operation", "GetSession").Str("upload_id", uploadID.String()).Msg("服务调用失败")
		writeError(w, http.StatusInternalServerError, "internal_error", "查询上传状态失败")
		return
	}

	log.Info().Int("status", http.StatusOK).Str("upload_id", uploadID.String()).Msg("请求处理成功")
	writeJSON(w, http.StatusOK, session)
}

// 确保 io 包被引用
var _ io.Reader = nil
