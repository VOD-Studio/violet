// Package announcement 提供 application 层用例（简化 CQRS，CRUD 模块合一）。
package announcement

import (
	"context"
	"time"

	domain "blog-api/internal/domain/announcement"
)

// AnnouncementDTO 公告读模型
type AnnouncementDTO struct {
	ID        int32  `json:"id"`
	Title     string `json:"title"`
	Content   string `json:"content"`
	Type      string `json:"type"`
	IsActive  bool   `json:"is_active"`
	StartTime string `json:"start_time,omitempty"`
	EndTime   string `json:"end_time,omitempty"`
	CreatedAt string `json:"created_at"`
}

// Service 公告用例服务（简化 DDD：CRUD 不强制 command/query 分包）
type Service struct {
	repo domain.AnnouncementRepository
}

// NewService 构造公告用例服务
func NewService(repo domain.AnnouncementRepository) *Service {
	return &Service{repo: repo}
}

// List 获取所有公告
func (s *Service) List(ctx context.Context) ([]AnnouncementDTO, error) {
	items, err := s.repo.FindAll(ctx)
	if err != nil {
		return nil, err
	}
	dtos := make([]AnnouncementDTO, 0, len(items))
	for _, a := range items {
		dtos = append(dtos, toDTO(a))
	}
	return dtos, nil
}

// ListActive 获取当前生效的公告（前台展示）
func (s *Service) ListActive(ctx context.Context) ([]AnnouncementDTO, error) {
	items, err := s.repo.FindActive(ctx)
	if err != nil {
		return nil, err
	}
	dtos := make([]AnnouncementDTO, 0, len(items))
	for _, a := range items {
		dtos = append(dtos, toDTO(a))
	}
	return dtos, nil
}

// Get 获取单个公告
func (s *Service) Get(ctx context.Context, id int32) (AnnouncementDTO, error) {
	a, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return AnnouncementDTO{}, err
	}
	return toDTO(a), nil
}

// CreateInput 创建公告入参
type CreateInput struct {
	Title     string
	Content   string
	Type      string
	StartTime *time.Time
	EndTime   *time.Time
}

// Create 创建公告
func (s *Service) Create(ctx context.Context, in CreateInput) (int32, error) {
	a, err := domain.NewAnnouncement(0, in.Title, in.Content, in.Type)
	if err != nil {
		return 0, err
	}
	if err := a.SetTimeRange(in.StartTime, in.EndTime); err != nil {
		return 0, err
	}
	return s.repo.Save(ctx, a)
}

// UpdateInput 更新公告入参
type UpdateInput struct {
	ID        int32
	Title     string
	Content   string
	Type      string
	IsActive  *bool
	StartTime *time.Time
	EndTime   *time.Time
}

// Update 更新公告
func (s *Service) Update(ctx context.Context, in UpdateInput) error {
	a, err := s.repo.FindByID(ctx, in.ID)
	if err != nil {
		return err
	}
	if err := a.Update(in.Title, in.Content, in.Type); err != nil {
		return err
	}
	if in.IsActive != nil {
		a.SetActive(*in.IsActive)
	}
	if err := a.SetTimeRange(in.StartTime, in.EndTime); err != nil {
		return err
	}
	_, err = s.repo.Save(ctx, a)
	return err
}

// Delete 删除公告
func (s *Service) Delete(ctx context.Context, id int32) error {
	return s.repo.Delete(ctx, id)
}

func toDTO(a *domain.Announcement) AnnouncementDTO {
	dto := AnnouncementDTO{
		ID: a.ID(), Title: a.Title(), Content: a.Content(),
		Type: a.Type(), IsActive: a.IsActive(),
		CreatedAt: a.CreatedAt().Format(time.RFC3339),
	}
	if a.StartTime() != nil {
		dto.StartTime = a.StartTime().Format(time.RFC3339)
	}
	if a.EndTime() != nil {
		dto.EndTime = a.EndTime().Format(time.RFC3339)
	}
	return dto
}
