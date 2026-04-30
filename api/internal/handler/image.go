package handler

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"blog-api/internal/middleware"
	"blog-api/internal/service"
)

// ImageHandler 图片管理接口处理器
type ImageHandler struct {
	imageService *service.ImageService
	uploadDir    string
	maxFileSize  int64
}

// NewImageHandler 创建图片管理处理器实例
// uploadDir 为本地存储目录，maxFileSize 为最大文件大小（字节）
func NewImageHandler(imageService *service.ImageService, uploadDir string, maxFileSize int64) *ImageHandler {
	return &ImageHandler{
		imageService: imageService,
		uploadDir:    uploadDir,
		maxFileSize:  maxFileSize,
	}
}

// Upload 上传图片
// POST /api/images/upload
// 需要认证，接受 multipart/form-data 格式的图片文件
func (h *ImageHandler) Upload(w http.ResponseWriter, r *http.Request) {
	// 限制请求体大小
	r.Body = http.MaxBytesReader(w, r.Body, h.maxFileSize)

	// 解析 multipart 表单
	if err := r.ParseMultipartForm(h.maxFileSize); err != nil {
		writeError(w, http.StatusBadRequest, "file_too_large", fmt.Sprintf("文件大小不能超过 %d GB", h.maxFileSize/1024/1024/1024))
		return
	}

	// 获取上传的文件
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_file", "缺少上传文件")
		return
	}
	defer file.Close()

	// 验证文件类型
	ext := strings.ToLower(filepath.Ext(header.Filename))
	mimeType := header.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = detectMimeType(ext)
	}

	allowedExts := map[string]bool{
		// 图片格式
		".jpg":  true,
		".jpeg": true,
		".png":  true,
		".gif":  true,
		".webp": true,
		".svg":  true,
		// 视频格式
		".mp4":  true,
		".webm": true,
		".mov":  true,
		".avi":  true,
		".mkv":  true,
		// 音频格式
		".mp3":  true,
		".wav":  true,
		".ogg":  true,
		".flac": true,
		".aac":  true,
		// 文档格式
		".pdf":  true,
		".doc":  true,
		".docx": true,
		".xls":  true,
		".xlsx": true,
		".ppt":  true,
		".pptx": true,
		".zip":  true,
		".rar":  true,
		".7z":   true,
	}
	if !allowedExts[ext] {
		writeError(w, http.StatusBadRequest, "invalid_type", "不支持的文件格式")
		return
	}

	// 生成唯一文件名
	filename := fmt.Sprintf("%s%s", uuid.New().String(), ext)

	// 确保上传目录存在
	if err := os.MkdirAll(h.uploadDir, 0755); err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "创建上传目录失败")
		return
	}

	// 创建目标文件
	dstPath := filepath.Join(h.uploadDir, filename)
	dst, err := os.Create(dstPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "保存文件失败")
		return
	}
	defer dst.Close()

	// 复制文件内容
	written, err := io.Copy(dst, file)
	if err != nil {
		os.Remove(dstPath)
		writeError(w, http.StatusInternalServerError, "internal_error", "保存文件失败")
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

	// 保存图片记录到数据库
	image, err := h.imageService.SaveImage(r.Context(), filename, header.Filename, mimeType, written, uploaderID)
	if err != nil {
		os.Remove(dstPath)
		if errors.Is(err, service.ErrInvalidImageType) {
			writeError(w, http.StatusBadRequest, "invalid_type", err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "保存图片记录失败")
		return
	}

	writeJSON(w, http.StatusCreated, image)
}

// List 图片列表
// GET /api/images
// 需要认证，支持分页查询
func (h *ImageHandler) List(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

	result, err := h.imageService.ListImages(r.Context(), page, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "查询图片列表失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"images": result.Images,
		"total":  result.Total,
		"page":   result.Page,
		"limit":  result.Limit,
	})
}

// Delete 删除图片
// DELETE /api/images/:id
// 需要认证，同时删除本地文件和数据库记录
func (h *ImageHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	imageID, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "无效的图片 ID")
		return
	}

	if err := h.imageService.DeleteImage(r.Context(), imageID); err != nil {
		if errors.Is(err, service.ErrImageNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "图片不存在")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "删除图片失败")
		return
	}

	writeJSON(w, http.StatusOK, MessageResponse{
		Message: "图片已删除",
	})
}

// detectMimeType 根据文件扩展名推断 MIME 类型
func detectMimeType(ext string) string {
	switch ext {
	// 图片
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	case ".svg":
		return "image/svg+xml"
	// 视频
	case ".mp4":
		return "video/mp4"
	case ".webm":
		return "video/webm"
	case ".mov":
		return "video/quicktime"
	case ".avi":
		return "video/x-msvideo"
	case ".mkv":
		return "video/x-matroska"
	// 音频
	case ".mp3":
		return "audio/mpeg"
	case ".wav":
		return "audio/wav"
	case ".ogg":
		return "audio/ogg"
	case ".flac":
		return "audio/flac"
	case ".aac":
		return "audio/aac"
	// 文档
	case ".pdf":
		return "application/pdf"
	case ".doc":
		return "application/msword"
	case ".docx":
		return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	case ".xls":
		return "application/vnd.ms-excel"
	case ".xlsx":
		return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	case ".ppt":
		return "application/vnd.ms-powerpoint"
	case ".pptx":
		return "application/vnd.openxmlformats-officedocument.presentationml.presentation"
	case ".zip":
		return "application/zip"
	case ".rar":
		return "application/vnd.rar"
	case ".7z":
		return "application/x-7z-compressed"
	default:
		return "application/octet-stream"
	}
}
