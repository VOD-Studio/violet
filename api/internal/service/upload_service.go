package service

import (
	"context"
	"crypto/md5"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/disintegration/imaging"
	"github.com/google/uuid"

	"blog-api/internal/repository/generated"
)

// 分片上传相关错误定义
var (
	// ErrUploadNotFound 上传任务不存在
	ErrUploadNotFound = errors.New("上传任务不存在")
	// ErrChunkAlreadyExists 分片已存在
	ErrChunkAlreadyExists = errors.New("分片已存在")
	// ErrUploadIncomplete 上传任务未完成
	ErrUploadIncomplete = errors.New("分片上传未完成")
)

// 支持的文件类型扩展名到 MIME 类型的映射
var allowedUploadTypes = map[string]string{
	// 图片
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".png":  "image/png",
	".gif":  "image/gif",
	".webp": "image/webp",
	".svg":  "image/svg+xml",
	// 视频
	".mp4":  "video/mp4",
	".webm": "video/webm",
	".mov":  "video/quicktime",
	".avi":  "video/x-msvideo",
	".mkv":  "video/x-matroska",
	// 音频
	".mp3":  "audio/mpeg",
	".wav":  "audio/wav",
	".ogg":  "audio/ogg",
	".flac": "audio/flac",
	".aac":  "audio/aac",
	// 文档
	".pdf":  "application/pdf",
	".doc":  "application/msword",
	".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	".xls":  "application/vnd.ms-excel",
	".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	".ppt":  "application/vnd.ms-powerpoint",
	".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
	".zip":  "application/zip",
	".rar":  "application/vnd.rar",
	".7z":   "application/x-7z-compressed",
	".md":   "text/markdown",
}

// UploadService 分片上传业务服务
type UploadService struct {
	queries         *generated.Queries
	mediaSvc        *MediaService
	chunkDir        string
	uploadDir       string
	maxFileSize     int64
	uploadPathPrefix string
}

// NewUploadService 创建分片上传服务实例
func NewUploadService(queries *generated.Queries, mediaSvc *MediaService, chunkDir, uploadDir string, maxFileSize int64, uploadPathPrefix string) *UploadService {
	return &UploadService{
		queries:         queries,
		mediaSvc:        mediaSvc,
		chunkDir:        chunkDir,
		uploadDir:       uploadDir,
		maxFileSize:     maxFileSize,
		uploadPathPrefix: uploadPathPrefix,
	}
}

// InitUploadRequest 初始化上传请求
type InitUploadRequest struct {
	Filename   string `json:"filename" validate:"required"`
	TotalSize  int64  `json:"total_size" validate:"required"`
	ChunkSize  int64  `json:"chunk_size" validate:"required"`
	FileHash   string `json:"file_hash"`
}

// InitUploadResponse 初始化上传响应
type InitUploadResponse struct {
	UploadID    string `json:"upload_id"`
	TotalChunks int32  `json:"total_chunks"`
}

// UploadChunkRequest 上传分片请求（通过 multipart 表单提交）
type UploadChunkRequest struct {
	UploadID   string
	ChunkIndex int32
}

// CompleteUploadResponse 合并上传响应
type CompleteUploadResponse struct {
	MediaID   string `json:"media_id"`
	URL       string `json:"url"`
	Thumbnail string `json:"thumbnail,omitempty"`
}

// CheckUploadRequest 秒传检查请求
type CheckUploadRequest struct {
	FileHash string `json:"file_hash" validate:"required"`
}

// CheckUploadResponse 秒传检查响应
type CheckUploadResponse struct {
	Exists  bool   `json:"exists"`
	MediaID string `json:"media_id,omitempty"`
	URL     string `json:"url,omitempty"`
}

// InitUpload 初始化分片上传
// 生成 upload_id，计算分片数量
func (s *UploadService) InitUpload(ctx context.Context, req InitUploadRequest) (*InitUploadResponse, error) {
	// 验证文件类型
	ext := strings.ToLower(filepath.Ext(req.Filename))
	if _, ok := allowedUploadTypes[ext]; !ok {
		return nil, ErrInvalidImageType
	}

	// 验证文件大小
	if req.TotalSize > s.maxFileSize {
		return nil, ErrImageTooLarge
	}

	// 计算分片数量
	totalChunks := int32((req.TotalSize + req.ChunkSize - 1) / req.ChunkSize)
	if totalChunks == 0 {
		totalChunks = 1
	}

	// 生成 upload_id
	uploadID := uuid.New().String()

	// 确保分片存储目录存在
	chunkPath := filepath.Join(s.chunkDir, uploadID)
	if err := os.MkdirAll(chunkPath, 0755); err != nil {
		return nil, fmt.Errorf("创建分片目录失败: %w", err)
	}

	return &InitUploadResponse{
		UploadID:    uploadID,
		TotalChunks: totalChunks,
	}, nil
}

// UploadChunk 上传单个分片
func (s *UploadService) UploadChunk(ctx context.Context, uploadID string, chunkIndex int32, totalChunks int32, fileHash, filename, mimeType string, reader io.Reader) error {
	// 保存分片文件
	chunkPath := filepath.Join(s.chunkDir, uploadID, fmt.Sprintf("chunk_%d", chunkIndex))
	dst, err := os.Create(chunkPath)
	if err != nil {
		return fmt.Errorf("创建分片文件失败: %w", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, reader); err != nil {
		return fmt.Errorf("写入分片文件失败: %w", err)
	}

	// 保存分片记录到数据库
	_, err = s.queries.CreateUploadChunk(ctx, generated.CreateUploadChunkParams{
		UploadID:    uploadID,
		ChunkIndex:  chunkIndex,
		TotalChunks: totalChunks,
		FileHash:    toNullString(fileHash),
		Filename:    toNullString(filename),
		MimeType:    toNullString(mimeType),
		ChunkPath:   chunkPath,
	})
	if err != nil {
		return fmt.Errorf("保存分片记录失败: %w", err)
	}

	return nil
}

// CompleteUpload 合并所有分片为完整文件，并生成缩略图
func (s *UploadService) CompleteUpload(ctx context.Context, uploadID string, uploaderID *uuid.UUID) (*CompleteUploadResponse, error) {
	// 查询分片信息
	info, err := s.queries.GetChunkInfo(ctx, uploadID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUploadNotFound
		}
		return nil, fmt.Errorf("查询分片信息失败: %w", err)
	}

	// 检查所有分片是否已上传
	uploadedCount, err := s.queries.CountChunksByUploadID(ctx, uploadID)
	if err != nil {
		return nil, fmt.Errorf("统计分片数失败: %w", err)
	}
	if uploadedCount < int64(info.TotalChunks) {
		return nil, ErrUploadIncomplete
	}

	// 查询所有分片，按索引排序
	chunks, err := s.queries.GetChunksByUploadID(ctx, uploadID)
	if err != nil {
		return nil, fmt.Errorf("查询分片列表失败: %w", err)
	}

	// 确定文件名和 MIME 类型
	filename := "unknown"
	mimeType := "application/octet-stream"
	if info.Filename.Valid && info.Filename.String != "" {
		filename = info.Filename.String
	}
	if info.MimeType.Valid && info.MimeType.String != "" {
		mimeType = info.MimeType.String
	}

	// 兜底：从文件扩展名推断 MIME 类型
	if mimeType == "application/octet-stream" && filename != "unknown" {
		ext := strings.ToLower(filepath.Ext(filename))
		if inferred, ok := allowedUploadTypes[ext]; ok {
			mimeType = inferred
		}
	}

	// 生成最终文件名
	ext := filepath.Ext(filename)
	finalFilename := fmt.Sprintf("%s%s", uuid.New().String(), ext)

	// 合并分片到最终文件
	finalPath := filepath.Join(s.uploadDir, finalFilename)
	dst, err := os.Create(finalPath)
	if err != nil {
		return nil, fmt.Errorf("创建最终文件失败: %w", err)
	}
	defer dst.Close()

	var totalSize int64
	for _, chunk := range chunks {
		src, err := os.Open(chunk.ChunkPath)
		if err != nil {
			return nil, fmt.Errorf("打开分片文件失败: %w", err)
		}
		written, err := io.Copy(dst, src)
		src.Close()
		if err != nil {
			return nil, fmt.Errorf("合并分片失败: %w", err)
		}
		totalSize += written
	}

	// 生成缩略图
	thumbnail := ""
	if strings.HasPrefix(mimeType, "image/") {
		thumbnail = s.generateImageThumbnail(finalPath, finalFilename)
	} else if strings.HasPrefix(mimeType, "video/") {
		thumbnail = s.generateVideoThumbnail(finalPath, finalFilename)
	}

	// 创建媒体记录
	media, err := s.mediaSvc.CreateMedia(ctx, finalFilename, filename, mimeType, totalSize, s.uploadPathPrefix+finalFilename, nil, nil, nil, uploaderID, "public")
	if err != nil {
		return nil, fmt.Errorf("创建媒体记录失败: %w", err)
	}

	// 更新媒体记录的缩略图字段
	if thumbnail != "" {
		err = s.queries.UpdateMediaThumbnail(ctx, generated.UpdateMediaThumbnailParams{
			ID:        uuid.MustParse(media.ID),
			Thumbnail: toNullString(thumbnail),
		})
		if err != nil {
			// 缩略图更新失败不影响主流程，仅记录日志
		}
	}

	// 清理分片文件和记录
	s.cleanupChunks(uploadID)

	return &CompleteUploadResponse{
		MediaID:   media.ID,
		URL:       media.Path,
		Thumbnail: thumbnail,
	}, nil
}

// CheckUpload 秒传检查
// 通过文件哈希检查文件是否已存在
func (s *UploadService) CheckUpload(ctx context.Context, fileHash string) (*CheckUploadResponse, error) {
	// 查询是否有匹配的分片记录
	chunks, err := s.queries.GetChunksByUploadID(ctx, fileHash)
	if err != nil {
		return nil, fmt.Errorf("查询失败: %w", err)
	}

	// 如果有记录，说明文件已上传过
	if len(chunks) > 0 {
		info, _ := s.queries.GetChunkInfo(ctx, fileHash)
		if info != nil && info.Filename.Valid {
			return &CheckUploadResponse{
				Exists: true,
			}, nil
		}
	}

	return &CheckUploadResponse{Exists: false}, nil
}

// GetUploadedChunks 获取已上传的分片列表（用于断点续传）
func (s *UploadService) GetUploadedChunks(ctx context.Context, uploadID string) ([]int32, error) {
	chunks, err := s.queries.GetChunksByUploadID(ctx, uploadID)
	if err != nil {
		return nil, fmt.Errorf("查询分片列表失败: %w", err)
	}

	indices := make([]int32, 0, len(chunks))
	for _, chunk := range chunks {
		indices = append(indices, chunk.ChunkIndex)
	}
	return indices, nil
}

// cleanupChunks 清理分片文件和数据库记录
func (s *UploadService) cleanupChunks(uploadID string) {
	// 删除分片目录
	chunkPath := filepath.Join(s.chunkDir, uploadID)
	os.RemoveAll(chunkPath)

	// 删除数据库记录（忽略错误）
	s.queries.DeleteChunksByUploadID(context.Background(), uploadID)
}

// ComputeMD5 计算文件的 MD5 哈希值
func ComputeMD5(reader io.Reader) (string, error) {
	h := md5.New()
	if _, err := io.Copy(h, reader); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// generateImageThumbnail 生成图片缩略图
// 返回缩略图文件名，格式为 {basename}_thumb.jpg
func (s *UploadService) generateImageThumbnail(filePath, filename string) string {
	// 打开原始图片
	img, err := imaging.Open(filePath)
	if err != nil {
		return ""
	}

	// 缩略图尺寸：最大宽高 300px，保持比例
	thumb := imaging.Resize(img, 300, 0, imaging.Lanczos)

	// 生成缩略图文件名
	ext := filepath.Ext(filename)
	baseName := filename[:len(filename)-len(ext)]
	thumbFilename := baseName + "_thumb.jpg"
	thumbPath := filepath.Join(s.uploadDir, thumbFilename)

	// 保存为 JPEG，质量 80%
	if err := imaging.Save(thumb, thumbPath, imaging.JPEGQuality(80)); err != nil {
		return ""
	}

	return thumbFilename
}

// generateVideoThumbnail 使用 ffmpeg 提取视频帧作为缩略图
// 返回缩略图文件名，格式为 {basename}_thumb.jpg
func (s *UploadService) generateVideoThumbnail(filePath, filename string) string {
	// 检查 ffmpeg 是否可用
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		return ""
	}

	// 生成缩略图文件名
	ext := filepath.Ext(filename)
	baseName := filename[:len(filename)-len(ext)]
	thumbFilename := baseName + "_thumb.jpg"
	thumbPath := filepath.Join(s.uploadDir, thumbFilename)

	// 使用 ffmpeg 提取第 1 秒的帧
	cmd := exec.Command("ffmpeg",
		"-i", filePath,
		"-ss", "1",           // 从第 1 秒开始
		"-vframes", "1",      // 只提取 1 帧
		"-vf", "scale=300:-1", // 缩放到宽度 300，高度自动
		"-f", "image2",
		thumbPath,
		"-y",                 // 覆盖已存在的文件
	)

	// 隐藏 ffmpeg 输出
	cmd.Stdout = nil
	cmd.Stderr = nil

	if err := cmd.Run(); err != nil {
		return ""
	}

	// 检查缩略图是否生成成功
	if _, err := os.Stat(thumbPath); os.IsNotExist(err) {
		return ""
	}

	return thumbFilename
}
