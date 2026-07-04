// Package announcement 提供 application 层用例（简化 CQRS，CRUD 模块合一）。
package announcement

import (
	"context"
	"time"

	domain "blog-api/internal/domain/announcement"
)

// AnnouncementDTO 公告读模型
type AnnouncementDTO struct {
	ID          int32    `json:"id"`
	Title       string   `json:"title"`
	Content     string   `json:"content"`
	Type        string   `json:"type"`     // DB 列名保留,语义为 severity
	Severity    string   `json:"severity"` // 冗余字段,前端消费 severity 语义
	Display     string   `json:"display"`
	IsActive    bool     `json:"is_active"`
	StartTime   string   `json:"start_time,omitempty"`
	EndTime     string   `json:"end_time,omitempty"`
	SortOrder   int      `json:"sort_order"`
	Affects     []string `json:"affects,omitempty"`
	ContentMD   string   `json:"content_md,omitempty"`
	ContentHTML string   `json:"content_html,omitempty"`
	CoverImage  string   `json:"cover_image,omitempty"`
	Excerpt     string   `json:"excerpt,omitempty"`
	CreatedAt   string   `json:"created_at"`
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
	Title       string
	Content     string
	Type        string // severity
	Display     string
	StartTime   *time.Time
	EndTime     *time.Time
	SortOrder   int
	Affects     []string
	ContentMD   string
	ContentHTML string
	CoverImage  string
	Excerpt     string
}

// Create 创建公告
func (s *Service) Create(ctx context.Context, in CreateInput) (int32, error) {
	a, err := domain.NewAnnouncement(0, in.Title, in.Content, in.Type)
	if err != nil {
		return 0, err
	}
	if in.Display != "" {
		if err := a.SetDisplay(in.Display); err != nil {
			return 0, err
		}
	}
	if err := a.SetTimeRange(in.StartTime, in.EndTime); err != nil {
		return 0, err
	}
	a.SetSortOrder(in.SortOrder)
	a.SetAffects(in.Affects)
	a.SetRichContent(in.ContentMD, in.ContentHTML, in.CoverImage, in.Excerpt)
	return s.repo.Save(ctx, a)
}

// UpdateInput 更新公告入参
type UpdateInput struct {
	ID          int32
	Title       string
	Content     string
	Type        string // severity
	Display     string
	IsActive    *bool
	StartTime   *time.Time
	EndTime     *time.Time
	SortOrder   *int
	Affects     []string
	ContentMD   string
	ContentHTML string
	CoverImage  string
	Excerpt     string
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
	if in.Display != "" {
		if err := a.SetDisplay(in.Display); err != nil {
			return err
		}
	}
	if in.IsActive != nil {
		a.SetActive(*in.IsActive)
	}
	if in.SortOrder != nil {
		a.SetSortOrder(*in.SortOrder)
	}
	a.SetAffects(in.Affects)
	a.SetRichContent(in.ContentMD, in.ContentHTML, in.CoverImage, in.Excerpt)
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
		Type: a.Severity(), Severity: a.Severity(),
		Display: a.Display(), IsActive: a.IsActive(),
		SortOrder: a.SortOrder(),
		ContentMD: a.ContentMD(), ContentHTML: a.ContentHTML(),
		CoverImage: a.CoverImage(), Excerpt: a.Excerpt(),
		CreatedAt: a.CreatedAt().Format(time.RFC3339),
	}
	if affects := a.Affects(); len(affects) > 0 {
		dto.Affects = affects
	}
	if a.StartTime() != nil {
		dto.StartTime = a.StartTime().Format(time.RFC3339)
	}
	if a.EndTime() != nil {
		dto.EndTime = a.EndTime().Format(time.RFC3339)
	}
	return dto
}
