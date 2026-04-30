package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"blog-api/internal/middleware"
	"blog-api/internal/service"

	"github.com/google/uuid"
)

// UploadHandler 分片上传接口处理器
type UploadHandler struct {
	uploadService *service.UploadService
	baseURL       string
}

// NewUploadHandler 创建分片上传处理器实例
func NewUploadHandler(uploadService *service.UploadService, baseURL string) *UploadHandler {
	return &UploadHandler{
		uploadService: uploadService,
		baseURL:       baseURL,
	}
}

// InitUpload 初始化分片上传
// POST /api/upload/init
// 需要认证，返回 upload_id 和总分片数
func (h *UploadHandler) InitUpload(w http.ResponseWriter, r *http.Request) {
	var req service.InitUploadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	if req.Filename == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "文件名为必填项")
		return
	}
	if req.TotalSize <= 0 {
		writeError(w, http.StatusBadRequest, "validation_error", "文件大小必须大于 0")
		return
	}
	if req.ChunkSize <= 0 {
		writeError(w, http.StatusBadRequest, "validation_error", "分片大小必须大于 0")
		return
	}

	result, err := h.uploadService.InitUpload(r.Context(), req)
	if err != nil {
		if errors.Is(err, service.ErrInvalidImageType) {
			writeError(w, http.StatusBadRequest, "invalid_type", "不支持的文件类型")
			return
		}
		if errors.Is(err, service.ErrImageTooLarge) {
			writeError(w, http.StatusBadRequest, "file_too_large", "文件大小超过限制")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "初始化上传失败")
		return
	}

	writeJSON(w, http.StatusOK, result)
}

// UploadChunk 上传单个分片
// POST /api/upload/chunk
// 需要认证，支持断点续传
func (h *UploadHandler) UploadChunk(w http.ResponseWriter, r *http.Request) {
	// 限制分片大小为 50MB
	r.Body = http.MaxBytesReader(w, r.Body, 50*1024*1024)

	if err := r.ParseMultipartForm(50 * 1024 * 1024); err != nil {
		writeError(w, http.StatusBadRequest, "file_too_large", "分片大小不能超过 50 MB")
		return
	}

	uploadID := r.FormValue("upload_id")
	chunkIndexStr := r.FormValue("chunk_index")
	totalChunksStr := r.FormValue("total_chunks")
	fileHash := r.FormValue("file_hash")
	filename := r.FormValue("filename")
	mimeType := r.FormValue("mime_type")

	if uploadID == "" || chunkIndexStr == "" || totalChunksStr == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "缺少必填参数")
		return
	}

	chunkIndex, err := strconv.Atoi(chunkIndexStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "无效的分片索引")
		return
	}

	totalChunks, err := strconv.Atoi(totalChunksStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "无效的总分片数")
		return
	}

	file, _, err := r.FormFile("chunk")
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_file", "缺少分片文件")
		return
	}
	defer file.Close()

	if err := h.uploadService.UploadChunk(r.Context(), uploadID, int32(chunkIndex), int32(totalChunks), fileHash, filename, mimeType, file); err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "上传分片失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":     "分片上传成功",
		"upload_id":   uploadID,
		"chunk_index": chunkIndex,
	})
}

// CompleteUpload 合并分片
// POST /api/upload/complete
// 需要认证，将所有分片合并为完整文件
func (h *UploadHandler) CompleteUpload(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UploadID string `json:"upload_id" validate:"required"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	if req.UploadID == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "upload_id 为必填项")
		return
	}

	// 获取上传者 ID
	userIDStr := middleware.GetUserID(r.Context())
	var uploaderID *uuid.UUID
	if userIDStr != "" {
		uid, err := uuid.Parse(userIDStr)
		if err == nil {
			uploaderID = &uid
		}
	}

	result, err := h.uploadService.CompleteUpload(r.Context(), req.UploadID, h.baseURL, uploaderID)
	if err != nil {
		if errors.Is(err, service.ErrUploadNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "上传任务不存在")
			return
		}
		if errors.Is(err, service.ErrUploadIncomplete) {
			writeError(w, http.StatusBadRequest, "incomplete", "分片上传未完成")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "合并文件失败")
		return
	}

	writeJSON(w, http.StatusOK, result)
}

// CheckUpload 秒传检查
// POST /api/upload/check
// 通过 MD5 校验检查文件是否已存在
func (h *UploadHandler) CheckUpload(w http.ResponseWriter, r *http.Request) {
	var req service.CheckUploadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	if req.FileHash == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "file_hash 为必填项")
		return
	}

	result, err := h.uploadService.CheckUpload(r.Context(), req.FileHash)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "检查失败")
		return
	}

	writeJSON(w, http.StatusOK, result)
}

// GetUploadedChunks 获取已上传的分片列表（断点续传）
// GET /api/upload/:id/chunks
func (h *UploadHandler) GetUploadedChunks(w http.ResponseWriter, r *http.Request) {
	uploadID := chi.URLParam(r, "id")
	if uploadID == "" {
		writeError(w, http.StatusBadRequest, "invalid_param", "缺少 upload_id")
		return
	}

	chunks, err := h.uploadService.GetUploadedChunks(r.Context(), uploadID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "查询分片列表失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"upload_id": uploadID,
		"chunks":    chunks,
	})
}

// 确保 fmt 包被引用
var _ = fmt.Sprintf
