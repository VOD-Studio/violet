// Package service 提供业务逻辑层，封装数据访问和业务规则
package service

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"blog-api/internal/repository/generated"
)

// AnnouncementService 公告服务
type AnnouncementService struct {
	queries *generated.Queries
}

// NewAnnouncementService 创建公告服务实例
func NewAnnouncementService(queries *generated.Queries) *AnnouncementService {
	return &AnnouncementService{queries: queries}
}

// AnnouncementListResult 公告列表结果
type AnnouncementListResult struct {
	Announcements []*generated.Announcement `json:"announcements"`
	Total         int64                     `json:"total"`
	Page          int                       `json:"page"`
	Limit         int                       `json:"limit"`
}

// ListActiveAnnouncements 获取当前生效的公告列表（公开接口）
func (s *AnnouncementService) ListActiveAnnouncements(ctx context.Context) ([]*generated.ListActiveAnnouncementsRow, error) {
	log.Info().Str("service", "AnnouncementService").Str("operation", "ListActiveAnnouncements").Msg("查询生效公告")

	announcements, err := s.queries.ListActiveAnnouncements(ctx)
	if err != nil {
		log.Error().Err(err).Msg("查询生效公告失败")
		return nil, fmt.Errorf("查询生效公告失败: %w", err)
	}

	log.Info().Int("count", len(announcements)).Msg("生效公告查询成功")
	return announcements, nil
}

// ListAllAnnouncements 获取所有公告列表（管理接口）
func (s *AnnouncementService) ListAllAnnouncements(ctx context.Context, page, limit int) (*AnnouncementListResult, error) {
	log.Info().Str("service", "AnnouncementService").Str("operation", "ListAllAnnouncements").
		Int("page", page).Int("limit", limit).Msg("查询所有公告")

	if limit <= 0 {
		limit = 20
	}
	offset := page * limit

	announcements, err := s.queries.ListAllAnnouncements(ctx, generated.ListAllAnnouncementsParams{
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		log.Error().Err(err).Msg("查询公告列表失败")
		return nil, fmt.Errorf("查询公告列表失败: %w", err)
	}

	total, err := s.queries.CountAnnouncements(ctx)
	if err != nil {
		log.Error().Err(err).Msg("统计公告失败")
		return nil, fmt.Errorf("统计公告失败: %w", err)
	}

	return &AnnouncementListResult{
		Announcements: announcements,
		Total:         total,
		Page:          page,
		Limit:         limit,
	}, nil
}

// CreateAnnouncement 创建公告
func (s *AnnouncementService) CreateAnnouncement(ctx context.Context, title, content, announcementType string, isActive bool, startTime, endTime sql.NullTime, createdBy uuid.NullUUID) (*generated.Announcement, error) {
	log.Info().Str("service", "AnnouncementService").Str("operation", "CreateAnnouncement").
		Str("title", title).Msg("创建公告")

	announcement, err := s.queries.CreateAnnouncement(ctx, generated.CreateAnnouncementParams{
		Title:     title,
		Content:   content,
		Type:      announcementType,
		IsActive:  isActive,
		StartTime: startTime,
		EndTime:   endTime,
		CreatedBy: createdBy,
	})
	if err != nil {
		log.Error().Err(err).Msg("创建公告失败")
		return nil, fmt.Errorf("创建公告失败: %w", err)
	}

	log.Info().Int32("announcement_id", announcement.ID).Msg("公告创建成功")
	return announcement, nil
}

// UpdateAnnouncement 更新公告
func (s *AnnouncementService) UpdateAnnouncement(ctx context.Context, id int32, title, content, announcementType string, isActive bool, startTime, endTime sql.NullTime) (*generated.Announcement, error) {
	log.Info().Str("service", "AnnouncementService").Str("operation", "UpdateAnnouncement").
		Int32("announcement_id", id).Msg("更新公告")

	announcement, err := s.queries.UpdateAnnouncement(ctx, generated.UpdateAnnouncementParams{
		ID:        id,
		Title:     title,
		Content:   content,
		Type:      announcementType,
		IsActive:  isActive,
		StartTime: startTime,
		EndTime:   endTime,
	})
	if err != nil {
		log.Error().Err(err).Msg("更新公告失败")
		return nil, fmt.Errorf("更新公告失败: %w", err)
	}

	log.Info().Int32("announcement_id", id).Msg("公告更新成功")
	return announcement, nil
}

// DeleteAnnouncement 删除公告
func (s *AnnouncementService) DeleteAnnouncement(ctx context.Context, id int32) error {
	log.Info().Str("service", "AnnouncementService").Str("operation", "DeleteAnnouncement").
		Int32("announcement_id", id).Msg("删除公告")

	err := s.queries.DeleteAnnouncement(ctx, id)
	if err != nil {
		log.Error().Err(err).Msg("删除公告失败")
		return fmt.Errorf("删除公告失败: %w", err)
	}

	log.Info().Int32("announcement_id", id).Msg("公告删除成功")
	return nil
}