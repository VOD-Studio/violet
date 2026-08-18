// Package announcement 提供 application 层用例（简化 CQRS，CRUD 模块合一）。
package announcement

import (
	"context"
	"time"

	"github.com/rs/zerolog/log"

	appshared "blog-api/internal/application/shared"
	"blog-api/internal/domain/shared"
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
	bus   appshared.EventBus
}

// NewService 构造公告用例服务
func NewService(repo domain.AnnouncementRepository, bus appshared.EventBus) *Service {
	return &Service{repo: repo, bus: bus}
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

// ListPage 分页获取公告（后台）
func (s *Service) ListPage(ctx context.Context, q shared.PageQuery) (shared.PageResult[AnnouncementDTO], error) {
	result, err := s.repo.FindPage(ctx, q)
	if err != nil {
		return shared.PageResult[AnnouncementDTO]{}, err
	}
	dtos := make([]AnnouncementDTO, 0, len(result.Items))
	for _, a := range result.Items {
		dtos = append(dtos, toDTO(a))
	}
	return shared.NewPageResult(shared.PageQuery{Page: result.Page, Limit: result.Limit}, dtos, result.Total), nil
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

// GetActive 获取单个生效公告（公开端点用，非生效返回 NotFound）
func (s *Service) GetActive(ctx context.Context, id int32) (AnnouncementDTO, error) {
	a, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return AnnouncementDTO{}, err
	}
	if !a.IsCurrentlyActive(time.Now()) {
		return AnnouncementDTO{}, domain.ErrNotFound
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
	id, err := s.repo.Save(ctx, a)
	if err != nil {
		return 0, err
	}
	// 回填自增 ID，手动构造创建事件发布（聚合根不在 NewAnnouncement 里 RecordEvent）
	a.SetID(id)
	if err := s.bus.Publish(ctx, []shared.DomainEvent{domain.NewAnnouncementCreated(id)}); err != nil {
		log.Warn().Err(err).Msg("发布公告创建事件失败")
	}
	return id, nil
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
//
// display 字段创建后不可变更：不同形态的语义与必填字段不同，
// 中途切换会导致数据不完整（如从 card 切到 article 缺正文 html）。
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
	if in.SortOrder != nil {
		a.SetSortOrder(*in.SortOrder)
	}
	a.SetAffects(in.Affects)
	a.SetRichContent(in.ContentMD, in.ContentHTML, in.CoverImage, in.Excerpt)
	if err := a.SetTimeRange(in.StartTime, in.EndTime); err != nil {
		return err
	}
	if _, err := s.repo.Save(ctx, a); err != nil {
		return err
	}
	s.publishEvents(ctx, a)
	return nil
}

// Delete 删除公告
func (s *Service) Delete(ctx context.Context, id int32) error {
	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	// 删除后聚合根不可继续存在，手动构造事件发布
	if err := s.bus.Publish(ctx, []shared.DomainEvent{domain.NewAnnouncementDeleted(id)}); err != nil {
		log.Warn().Err(err).Msg("发布公告删除事件失败")
	}
	return nil
}

// publishEvents 发布聚合根累积的领域事件（审计订阅者消费）
func (s *Service) publishEvents(ctx context.Context, a *domain.Announcement) {
	events := a.PullEvents()
	if len(events) == 0 {
		return
	}
	if err := s.bus.Publish(ctx, events); err != nil {
		log.Warn().Err(err).Msg("发布公告事件失败")
	}
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
