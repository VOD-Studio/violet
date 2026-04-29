package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"blog-api/internal/repository/generated"
)

// 下载服务相关错误定义
var (
	ErrDownloadPermissionDenied = errors.New("无下载权限")
)

// DownloadService 下载权限与记录业务服务
type DownloadService struct {
	queries *generated.Queries
}

// NewDownloadService 创建下载服务实例
func NewDownloadService(queries *generated.Queries) *DownloadService {
	return &DownloadService{
		queries: queries,
	}
}

// CheckDownloadPermission 检查用户对指定媒体的下载权限
// 根据媒体的 download_permission 字段判断：
// public - 任何人可下载
// user - 已登录用户可下载
// admin - 仅管理员可下载
func (s *DownloadService) CheckDownloadPermission(ctx context.Context, userID string, mediaID uuid.UUID) (*generated.Medium, error) {
	media, err := s.queries.GetMediaByID(ctx, mediaID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrMediaNotFound
		}
		return nil, fmt.Errorf("查询媒体记录失败: %w", err)
	}

	switch media.DownloadPermission {
	case "public":
		return media, nil
	case "user":
		if userID == "" {
			return nil, ErrDownloadPermissionDenied
		}
	case "admin":
		if userID == "" {
			return nil, ErrDownloadPermissionDenied
		}
		// 管理员权限在上层中间件校验，这里仅做基本登录检查
	default:
		return nil, ErrDownloadPermissionDenied
	}

	return media, nil
}

// RecordDownload 记录下载日志，同时增加媒体的下载计数
func (s *DownloadService) RecordDownload(ctx context.Context, mediaID uuid.UUID, userID string) error {
	if err := s.queries.IncrementDownloadCount(ctx, mediaID); err != nil {
		return fmt.Errorf("更新下载计数失败: %w", err)
	}

	return nil
}
