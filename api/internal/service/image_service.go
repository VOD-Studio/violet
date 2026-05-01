package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/google/uuid"

	"blog-api/internal/repository/generated"
)

// 图片管理相关错误定义
var (
	// ErrImageNotFound 图片不存在
	ErrImageNotFound = errors.New("图片不存在")
	// ErrImageTooLarge 图片文件过大
	ErrImageTooLarge = errors.New("文件过大")
	// ErrInvalidImageType 不支持的文件类型
	ErrInvalidImageType = errors.New("不支持的文件类型")
)

// 支持的文件 MIME 类型
var allowedImageTypes = map[string]bool{
	// 图片
	"image/jpeg":    true,
	"image/png":     true,
	"image/gif":     true,
	"image/webp":    true,
	"image/svg+xml": true,
	// 视频
	"video/mp4":       true,
	"video/webm":      true,
	"video/quicktime": true,
	"video/x-msvideo": true,
	"video/x-matroska": true,
	// 音频
	"audio/mpeg": true,
	"audio/wav":  true,
	"audio/ogg":  true,
	"audio/flac": true,
	"audio/aac":  true,
	// 文档
	"application/pdf": true,
	"application/msword": true,
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
	"application/vnd.ms-excel": true,
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": true,
	"application/vnd.ms-powerpoint": true,
	"application/vnd.openxmlformats-officedocument.presentationml.presentation": true,
	"application/zip":  true,
	"application/vnd.rar": true,
	"application/x-7z-compressed": true,
}

// ImageService 图片管理业务服务
type ImageService struct {
	queries           *generated.Queries
	uploadDir         string
	uploadPathPrefix  string
}

// NewImageService 创建图片管理服务实例
// uploadDir 为本地存储目录，uploadPathPrefix 为路径前缀（如 "/uploads/"）
func NewImageService(queries *generated.Queries, uploadDir, uploadPathPrefix string) *ImageService {
	return &ImageService{
		queries:          queries,
		uploadDir:        uploadDir,
		uploadPathPrefix: uploadPathPrefix,
	}
}

// ImageResponse 图片响应结构
type ImageResponse struct {
	ID           string `json:"id"`
	Filename     string `json:"filename"`
	OriginalName string `json:"original_name"`
	URL          string `json:"url"`
	MimeType     string `json:"mime_type"`
	Size         int64  `json:"size"`
	CreatedAt    string `json:"created_at"`
}

// ListImagesResult 图片列表查询结果
type ListImagesResult struct {
	Images []*ImageResponse
	Total  int64
	Page   int
	Limit  int
}

// SaveImage 保存图片记录到数据库
func (s *ImageService) SaveImage(ctx context.Context, filename, originalName, mimeType string, size int64, uploaderID *uuid.UUID) (*ImageResponse, error) {
	// 验证图片类型
	if !allowedImageTypes[mimeType] {
		return nil, ErrInvalidImageType
	}

	// 构建访问 URL
	url := s.uploadPathPrefix + filename

	// 构建上传者参数
	var uploadedBy uuid.NullUUID
	if uploaderID != nil {
		uploadedBy = uuid.NullUUID{UUID: *uploaderID, Valid: true}
	}

	// 写入数据库
	image, err := s.queries.CreateImage(ctx, generated.CreateImageParams{
		Filename:     filename,
		OriginalName: originalName,
		Url:          url,
		MimeType:     mimeType,
		Size:         size,
		UploadedBy:   uploadedBy,
	})
	if err != nil {
		return nil, fmt.Errorf("保存图片记录失败: %w", err)
	}

	return &ImageResponse{
		ID:           image.ID.String(),
		Filename:     image.Filename,
		OriginalName: image.OriginalName,
		URL:          image.Url,
		MimeType:     image.MimeType,
		Size:         image.Size,
		CreatedAt:    image.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}, nil
}

// ListImages 分页查询图片列表
func (s *ImageService) ListImages(ctx context.Context, page, limit int) (*ListImagesResult, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	images, err := s.queries.ListImages(ctx, generated.ListImagesParams{
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		return nil, fmt.Errorf("查询图片列表失败: %w", err)
	}

	total, err := s.queries.CountImages(ctx)
	if err != nil {
		return nil, fmt.Errorf("统计图片数失败: %w", err)
	}

	items := make([]*ImageResponse, 0, len(images))
	for _, img := range images {
		items = append(items, &ImageResponse{
			ID:           img.ID.String(),
			Filename:     img.Filename,
			OriginalName: img.OriginalName,
			URL:          img.Url,
			MimeType:     img.MimeType,
			Size:         img.Size,
			CreatedAt:    img.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}

	return &ListImagesResult{
		Images: items,
		Total:  total,
		Page:   page,
		Limit:  limit,
	}, nil
}

// DeleteImage 删除图片（同时删除本地文件和数据库记录）
func (s *ImageService) DeleteImage(ctx context.Context, imageID uuid.UUID) error {
	// 查询图片记录
	image, err := s.queries.GetImageByID(ctx, imageID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrImageNotFound
		}
		return fmt.Errorf("查询图片失败: %w", err)
	}

	// 删除本地文件
	filePath := filepath.Join(s.uploadDir, image.Filename)
	if removeErr := os.Remove(filePath); removeErr != nil && !os.IsNotExist(removeErr) {
		// 文件删除失败不阻止数据库记录删除，仅记录日志
		fmt.Printf("删除图片文件失败: %v\n", removeErr)
	}

	// 删除数据库记录
	if err := s.queries.DeleteImage(ctx, imageID); err != nil {
		return fmt.Errorf("删除图片记录失败: %w", err)
	}

	return nil
}
