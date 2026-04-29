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

// 媒体管理相关错误定义
var (
	// ErrMediaNotFound 媒体不存在
	ErrMediaNotFound = errors.New("媒体不存在")
	// ErrDownloadForbidden 无权下载
	ErrDownloadForbidden = errors.New("无权下载此文件")
)

// 合法的下载权限列表
var validDownloadPermissions = map[string]bool{
	"public": true,
	"user":   true,
	"admin":  true,
}

// MediaService 媒体管理业务服务
type MediaService struct {
	queries   *generated.Queries
	uploadDir string
}

// NewMediaService 创建媒体管理服务实例
func NewMediaService(queries *generated.Queries, uploadDir string) *MediaService {
	return &MediaService{
		queries:   queries,
		uploadDir: uploadDir,
	}
}

// MediaResponse 媒体响应结构
type MediaResponse struct {
	ID                 string   `json:"id"`
	Filename           string   `json:"filename"`
	OriginalName       string   `json:"original_name"`
	MimeType           string   `json:"mime_type"`
	Size               int64    `json:"size"`
	Path               string   `json:"path"`
	Width              *int32   `json:"width,omitempty"`
	Height             *int32   `json:"height,omitempty"`
	Duration           *float64 `json:"duration,omitempty"`
	DownloadCount      int64    `json:"download_count"`
	DownloadPermission string   `json:"download_permission"`
	CreatedAt          string   `json:"created_at"`
}

// UpdateMediaRequest 更新媒体请求
type UpdateMediaRequest struct {
	OriginalName       *string `json:"original_name"`
	DownloadPermission *string `json:"download_permission"`
}

// ListMediaResult 媒体列表查询结果
type ListMediaResult struct {
	Media []*MediaResponse
	Total int64
	Page  int
	Limit int
}

// CreateMedia 创建媒体记录
func (s *MediaService) CreateMedia(ctx context.Context, filename, originalName, mimeType string, size int64, path string, width, height *int32, duration *float64, uploaderID *uuid.UUID, downloadPermission string) (*MediaResponse, error) {
	if downloadPermission == "" {
		downloadPermission = "public"
	}

	var w sql.NullInt32
	if width != nil {
		w = sql.NullInt32{Int32: *width, Valid: true}
	}
	var h sql.NullInt32
	if height != nil {
		h = sql.NullInt32{Int32: *height, Valid: true}
	}
	var d sql.NullFloat64
	if duration != nil {
		d = sql.NullFloat64{Float64: *duration, Valid: true}
	}
	var uploader uuid.NullUUID
	if uploaderID != nil {
		uploader = uuid.NullUUID{UUID: *uploaderID, Valid: true}
	}

	media, err := s.queries.CreateMedia(ctx, generated.CreateMediaParams{
		Filename:           filename,
		OriginalName:       originalName,
		MimeType:           mimeType,
		Size:               size,
		Path:               path,
		Width:              w,
		Height:             h,
		Duration:           d,
		UploaderID:         uploader,
		DownloadPermission: downloadPermission,
	})
	if err != nil {
		return nil, fmt.Errorf("创建媒体记录失败: %w", err)
	}

	return mediaToResponse(media), nil
}

// GetMediaByID 按 ID 获取媒体详情
func (s *MediaService) GetMediaByID(ctx context.Context, id uuid.UUID) (*MediaResponse, error) {
	media, err := s.queries.GetMediaByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrMediaNotFound
		}
		return nil, fmt.Errorf("查询媒体失败: %w", err)
	}

	return mediaToResponse(media), nil
}

// ListMedia 分页查询媒体列表
func (s *MediaService) ListMedia(ctx context.Context, page, limit int, mimeType string) (*ListMediaResult, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	var mediaList []*generated.Medium
	var total int64
	var err error

	if mimeType != "" {
		// 按类型筛选，使用前缀匹配
		pattern := mimeType + "%"
		mediaList, err = s.queries.ListMediaByType(ctx, generated.ListMediaByTypeParams{
			MimeType: pattern,
			Limit:    int32(limit),
			Offset:   int32(offset),
		})
		if err != nil {
			return nil, fmt.Errorf("查询媒体列表失败: %w", err)
		}
		total, err = s.queries.CountMediaByType(ctx, pattern)
		if err != nil {
			return nil, fmt.Errorf("统计媒体数失败: %w", err)
		}
	} else {
		mediaList, err = s.queries.ListMedia(ctx, generated.ListMediaParams{
			Limit:  int32(limit),
			Offset: int32(offset),
		})
		if err != nil {
			return nil, fmt.Errorf("查询媒体列表失败: %w", err)
		}
		total, err = s.queries.CountMedia(ctx)
		if err != nil {
			return nil, fmt.Errorf("统计媒体数失败: %w", err)
		}
	}

	items := make([]*MediaResponse, 0, len(mediaList))
	for _, m := range mediaList {
		items = append(items, mediaToResponse(m))
	}

	return &ListMediaResult{
		Media: items,
		Total: total,
		Page:  page,
		Limit: limit,
	}, nil
}

// UpdateMedia 更新媒体信息
func (s *MediaService) UpdateMedia(ctx context.Context, id uuid.UUID, req UpdateMediaRequest) (*MediaResponse, error) {
	// 查询现有记录
	existing, err := s.queries.GetMediaByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrMediaNotFound
		}
		return nil, fmt.Errorf("查询媒体失败: %w", err)
	}

	originalName := existing.OriginalName
	if req.OriginalName != nil {
		originalName = *req.OriginalName
	}
	downloadPerm := existing.DownloadPermission
	if req.DownloadPermission != nil {
		if !validDownloadPermissions[*req.DownloadPermission] {
			return nil, fmt.Errorf("无效的下载权限值: %s", *req.DownloadPermission)
		}
		downloadPerm = *req.DownloadPermission
	}

	media, err := s.queries.UpdateMedia(ctx, generated.UpdateMediaParams{
		ID:                 id,
		OriginalName:       originalName,
		DownloadPermission: downloadPerm,
	})
	if err != nil {
		return nil, fmt.Errorf("更新媒体失败: %w", err)
	}

	return mediaToResponse(media), nil
}

// DeleteMedia 删除媒体（同时删除本地文件和数据库记录）
func (s *MediaService) DeleteMedia(ctx context.Context, id uuid.UUID) error {
	media, err := s.queries.GetMediaByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrMediaNotFound
		}
		return fmt.Errorf("查询媒体失败: %w", err)
	}

	// 删除本地文件
	filePath := filepath.Join(s.uploadDir, media.Filename)
	if removeErr := os.Remove(filePath); removeErr != nil && !os.IsNotExist(removeErr) {
		fmt.Printf("删除媒体文件失败: %v\n", removeErr)
	}

	if err := s.queries.DeleteMedia(ctx, id); err != nil {
		return fmt.Errorf("删除媒体记录失败: %w", err)
	}

	return nil
}

// CheckDownloadPermission 检查下载权限
func (s *MediaService) CheckDownloadPermission(ctx context.Context, id uuid.UUID, userRole string) (*MediaResponse, error) {
	media, err := s.queries.GetMediaByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrMediaNotFound
		}
		return nil, fmt.Errorf("查询媒体失败: %w", err)
	}

	switch media.DownloadPermission {
	case "public":
		// 公开文件，任何人可下载
	case "user":
		// 需要登录
		if userRole == "" {
			return nil, ErrDownloadForbidden
		}
	case "admin":
		// 需要管理员权限
		if userRole != "admin" {
			return nil, ErrDownloadForbidden
		}
	}

	return mediaToResponse(media), nil
}

// IncrementDownloadCount 增加下载次数
func (s *MediaService) IncrementDownloadCount(ctx context.Context, id uuid.UUID) error {
	return s.queries.IncrementDownloadCount(ctx, id)
}

// mediaToResponse 将数据库模型转换为响应结构
func mediaToResponse(m *generated.Medium) *MediaResponse {
	r := &MediaResponse{
		ID:                 m.ID.String(),
		Filename:           m.Filename,
		OriginalName:       m.OriginalName,
		MimeType:           m.MimeType,
		Size:               m.Size,
		Path:               m.Path,
		DownloadCount:      m.DownloadCount,
		DownloadPermission: m.DownloadPermission,
		CreatedAt:          m.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
	if m.Width.Valid {
		r.Width = &m.Width.Int32
	}
	if m.Height.Valid {
		r.Height = &m.Height.Int32
	}
	if m.Duration.Valid {
		r.Duration = &m.Duration.Float64
	}
	return r
}
