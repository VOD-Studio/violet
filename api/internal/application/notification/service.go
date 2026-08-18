package notification

import (
	"context"
	"time"

	domainnotification "blog-api/internal/domain/notification"
	domainshared "blog-api/internal/domain/shared"
)

// Service 通知查询与已读管理用例。
type Service struct {
	repo domainnotification.NotificationRepository
	now  func() time.Time
}

// NewService 构造服务。now 为 nil 时用 time.Now。
func NewService(repo domainnotification.NotificationRepository, now func() time.Time) *Service {
	if now == nil {
		now = time.Now
	}
	return &Service{repo: repo, now: now}
}

// NotificationDTO 通知读模型。
type NotificationDTO struct {
	ID         string                 `json:"id"`
	SourceType string                 `json:"source_type"`
	SourceID   string                 `json:"source_id"`
	Title      string                 `json:"title"`
	Body       string                 `json:"body"`
	Payload    map[string]any         `json:"payload"`
	IsRead     bool                   `json:"is_read"`
	ReadAt     *string                `json:"read_at,omitempty"`
	CreatedAt  string                 `json:"created_at"`
}

// ListByUser 分页列出某用户的通知（页码/条数取钳制后的回显值）。
func (s *Service) ListByUser(ctx context.Context, userID domainshared.ID, q domainshared.PageQuery) (domainshared.PageResult[NotificationDTO], error) {
	result, err := s.repo.FindPage(ctx, domainnotification.ListFilter{UserID: userID}, q)
	if err != nil {
		return domainshared.PageResult[NotificationDTO]{}, err
	}
	dtos := make([]NotificationDTO, 0, len(result.Items))
	for _, n := range result.Items {
		dtos = append(dtos, toDTO(n))
	}
	return domainshared.NewPageResult(domainshared.PageQuery{Page: result.Page, Limit: result.Limit}, dtos, result.Total), nil
}

// CountUnread 统计未读数。
func (s *Service) CountUnread(ctx context.Context, userID domainshared.ID) (int64, error) {
	return s.repo.CountUnread(ctx, userID)
}

// MarkAsRead 标记单条已读。
func (s *Service) MarkAsRead(ctx context.Context, id, userID domainshared.ID) error {
	return s.repo.MarkAsRead(ctx, id, userID, s.now())
}

// MarkAllAsRead 标记全部已读。
func (s *Service) MarkAllAsRead(ctx context.Context, userID domainshared.ID) error {
	return s.repo.MarkAllAsRead(ctx, userID, s.now())
}

// FindAfterID 查某用户在指定 ID 之后的通知（SSE 断连补发用）。
func (s *Service) FindAfterID(ctx context.Context, userID, afterID domainshared.ID, limit int) ([]*domainnotification.Notification, error) {
	return s.repo.FindAfterID(ctx, userID, afterID, limit)
}

// toDTO 领域实体 → DTO。
func toDTO(n *domainnotification.Notification) NotificationDTO {
	dto := NotificationDTO{
		ID:         n.GetID().String(),
		SourceType: string(n.SourceType()),
		SourceID:   n.SourceID().String(),
		Title:      n.Title(),
		Body:       n.Body(),
		Payload:    n.Payload(),
		IsRead:     n.IsRead(),
		CreatedAt:  n.CreatedAt().Format(time.RFC3339),
	}
	if n.ReadAt() != nil {
		s := n.ReadAt().Format(time.RFC3339)
		dto.ReadAt = &s
	}
	return dto
}
