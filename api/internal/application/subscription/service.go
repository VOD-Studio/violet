// Package subscription 提供订阅源用例服务（application 层）。
//
// 承载订阅源的手动 CRUD（本期 T6）：建/列/查/改/暂停/恢复/删。
// 定时抓取能力在 T7（去重编排）/T8（调度 job）接入，本期 Service 不含抓取方法。
//
// 依赖方向：Service → domain/subscription.SubscriptionRepository（端口），
// 不直接依赖 GORM 实现，便于单测用 fake 替换（seam #2）。
package subscription

import (
	"context"
	"time"

	domainsubscription "blog-api/internal/domain/subscription"
	"blog-api/internal/domain/shared"
)

// Service 订阅源用例服务。
type Service struct {
	repo domainsubscription.SubscriptionRepository
	now  func() time.Time // 注入时钟，便于单测控制时间
}

// NewService 构造服务。now 为 nil 时用 time.Now。
func NewService(repo domainsubscription.SubscriptionRepository, now func() time.Time) *Service {
	if now == nil {
		now = time.Now
	}
	return &Service{repo: repo, now: now}
}

// --- 输入/输出 DTO ---

// CreateInput 创建订阅入参。
type CreateInput struct {
	UserID            string
	FeedURL           string
	Title             string
	Interval          string // 默认 daily 由调用方钳制
	AutoPublish       bool
	CanonicalOverride string
	Tags              []string
}

// UpdateInput 更新订阅配置入参（不含 feedURL/status/失败计数等运行态字段）。
type UpdateInput struct {
	ID                string
	UserID            string
	Title             string
	Interval          string
	AutoPublish       bool
	CanonicalOverride string
	Tags              []string
}

// SubscriptionDTO 订阅读模型（序列化跨层传输）。
type SubscriptionDTO struct {
	ID                 string   `json:"id"`
	FeedURL            string   `json:"feed_url"`
	Title              string   `json:"title"`
	SourceType         string   `json:"source_type"`
	Interval           string   `json:"interval"`
	AutoPublish        bool     `json:"auto_publish"`
	CanonicalOverride  string   `json:"canonical_override,omitempty"`
	Tags               []string `json:"tags"`
	Status             string   `json:"status"`
	ConsecutiveFailures int     `json:"consecutive_failures"`
	LastError          string   `json:"last_error,omitempty"`
	LastFetchedAt      string   `json:"last_fetched_at,omitempty"` // RFC3339
	NextFetchAt        string   `json:"next_fetch_at,omitempty"`
	RetryAfterUntil    string   `json:"retry_after_until,omitempty"`
	CreatedAt          string   `json:"created_at"`
	UpdatedAt          string   `json:"updated_at"`
}

// --- CRUD 用例 ---

// Create 创建订阅。
func (s *Service) Create(ctx context.Context, in CreateInput) (SubscriptionDTO, error) {
	uid, err := shared.ParseID(in.UserID)
	if err != nil {
		return SubscriptionDTO{}, err
	}
	// interval 空串回退到 daily（合理默认）
	interval := in.Interval
	if interval == "" {
		interval = domainsubscription.IntervalDaily
	}
	sub, err := domainsubscription.NewSubscription(uid, in.FeedURL, in.Title, interval, s.now())
	if err != nil {
		return SubscriptionDTO{}, err
	}
	// NewSubscription 只设了 title/interval，补齐 autoPublish/canonicalOverride/tags。
	// interval 已被 NewSubscription 校验过，UpdateConfig 见空会跳过校验保留原值。
	if err := sub.UpdateConfig(in.Title, "", in.AutoPublish, in.CanonicalOverride, in.Tags); err != nil {
		return SubscriptionDTO{}, err
	}
	if err := s.repo.Save(ctx, sub); err != nil {
		return SubscriptionDTO{}, err
	}
	return toDTO(sub), nil
}

// GetByID 查单个订阅（所有权校验：userID 必须匹配）。
func (s *Service) GetByID(ctx context.Context, id, userID string) (SubscriptionDTO, error) {
	sub, err := s.findByID(ctx, id, userID)
	if err != nil {
		return SubscriptionDTO{}, err
	}
	return toDTO(sub), nil
}

// ListByUser 列出某用户的订阅（分页 + 可选 status 过滤）。
// status 空串 = 不过滤；page 从 1 起；limit 由调用方钳制上限。
func (s *Service) ListByUser(ctx context.Context, userID, status string, page, limit int) ([]SubscriptionDTO, int64, error) {
	uid, err := shared.ParseID(userID)
	if err != nil {
		return nil, 0, err
	}
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	subs, total, err := s.repo.FindByUser(ctx, uid, status, page, limit)
	if err != nil {
		return nil, 0, err
	}
	dtos := make([]SubscriptionDTO, 0, len(subs))
	for _, sub := range subs {
		dtos = append(dtos, toDTO(sub))
	}
	return dtos, total, nil
}

// Update 更新订阅配置（不含运行态字段）。
func (s *Service) Update(ctx context.Context, in UpdateInput) error {
	sub, err := s.findByID(ctx, in.ID, in.UserID)
	if err != nil {
		return err
	}
	if err := sub.UpdateConfig(in.Title, in.Interval, in.AutoPublish, in.CanonicalOverride, in.Tags); err != nil {
		return err
	}
	return s.repo.Save(ctx, sub)
}

// Pause 手动暂停订阅。
func (s *Service) Pause(ctx context.Context, id, userID string) error {
	sub, err := s.findByID(ctx, id, userID)
	if err != nil {
		return err
	}
	sub.Pause()
	return s.repo.Save(ctx, sub)
}

// Resume 手动恢复订阅（清零失败计数回 active）。
func (s *Service) Resume(ctx context.Context, id, userID string) error {
	sub, err := s.findByID(ctx, id, userID)
	if err != nil {
		return err
	}
	sub.Resume()
	return s.repo.Save(ctx, sub)
}

// Delete 删除订阅（连带其 entries 在 T7 加表后由 ON DELETE CASCADE 处理）。
func (s *Service) Delete(ctx context.Context, id, userID string) error {
	sid, err := shared.ParseID(id)
	if err != nil {
		return err
	}
	uid, err := shared.ParseID(userID)
	if err != nil {
		return err
	}
	return s.repo.Delete(ctx, sid, uid)
}

// --- 内部辅助 ---

// findByID 解析 ID + 走 repo（带所有权校验）。
func (s *Service) findByID(ctx context.Context, id, userID string) (*domainsubscription.Subscription, error) {
	sid, err := shared.ParseID(id)
	if err != nil {
		return nil, err
	}
	uid, err := shared.ParseID(userID)
	if err != nil {
		return nil, err
	}
	return s.repo.FindByID(ctx, sid, uid)
}

// toDTO 领域实体 → DTO（时间格式化 RFC3339，零值省略）。
func toDTO(s *domainsubscription.Subscription) SubscriptionDTO {
	dto := SubscriptionDTO{
		ID:                  s.ID().String(),
		FeedURL:             s.FeedURL(),
		Title:               s.Title(),
		SourceType:          s.SourceType(),
		Interval:            s.Interval(),
		AutoPublish:         s.AutoPublish(),
		CanonicalOverride:   s.CanonicalOverride(),
		Tags:                s.Tags(),
		Status:              s.Status(),
		ConsecutiveFailures: s.ConsecutiveFailures(),
		LastError:           s.LastError(),
		CreatedAt:           s.CreatedAt().Format(time.RFC3339),
		UpdatedAt:           s.UpdatedAt().Format(time.RFC3339),
	}
	if s.LastFetchedAt() != nil {
		dto.LastFetchedAt = s.LastFetchedAt().Format(time.RFC3339)
	}
	if s.NextFetchAt() != nil {
		dto.NextFetchAt = s.NextFetchAt().Format(time.RFC3339)
	}
	if s.RetryAfterUntil() != nil {
		dto.RetryAfterUntil = s.RetryAfterUntil().Format(time.RFC3339)
	}
	return dto
}
