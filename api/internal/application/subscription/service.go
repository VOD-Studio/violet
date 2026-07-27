// Package subscription 提供订阅源用例服务（application 层）。
//
// 承载订阅源的手动 CRUD（T6）+ 单次抓取编排 FetchOne（T7）。
// 定时调度在 T8 接入（job/subscription_job.go 调 FetchOne）。
//
// 依赖方向：Service → domain 端口（SubscriptionRepository / EntryRepository），
// 抓取通过 PostImporter / FeedParser 端口反转依赖 application/post，便于单测 fake。
package subscription

import (
	"context"
	"fmt"
	"time"

	domainsubscription "blog-api/internal/domain/subscription"
	domainentry "blog-api/internal/domain/subscription_entry"
	"blog-api/internal/domain/shared"

	apppost "blog-api/internal/application/post"
)

// Service 订阅源用例服务。
//
// 基础依赖（CRUD 用）：repo（订阅仓储）+ now（时钟）。
// FetchOne 依赖（抓取用）：entryRepo + importer + parser。后三者通过 SetFetchDeps 注入，
// 不在 NewService 强制要求——CRUD-only 场景（如 MCP tool 测试）可不注入。
type Service struct {
	repo      domainsubscription.SubscriptionRepository
	now       func() time.Time // 注入时钟，便于单测控制时间
	entryRepo domainentry.EntryRepository
	importer  PostImporter
	parser    FeedParser
}

// NewService 构造服务。now 为 nil 时用 time.Now。
func NewService(repo domainsubscription.SubscriptionRepository, now func() time.Time) *Service {
	if now == nil {
		now = time.Now
	}
	return &Service{repo: repo, now: now}
}

// SetFetchDeps 注入 FetchOne 抓取所需依赖（条目仓储 + 文章导入器 + feed 解析器）。
// 在 container 装配时调用；不调则 FetchOne 返回错误（CRUD 场景不需要）。
func (s *Service) SetFetchDeps(entryRepo domainentry.EntryRepository, importer PostImporter, parser FeedParser) {
	s.entryRepo = entryRepo
	s.importer = importer
	s.parser = parser
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

// FetchReport 单次 FetchOne 的抓取报告（T8 调度器记日志用）。
type FetchReport struct {
	SubscriptionID    string
	FeedEntryCount    int // feed 里总条目数
	NewEntries        int // 首次见到（去重后实际处理）
	Imported          int // 成功建草稿
	Failed            int // 抓正文失败（含重试中的 failed）
	Dead              int // 本次新触发 dead（达 fail_count 上限）
	Skipped           int // 已处理（imported/dead），跳过
	SubscriptionError string // feed 拉取层面的错误描述（非空表示整轮失败）
	FeedErr           error // 原始 feed 错误（*FeedError 类型便于 T8 分类，非 feed 错误为 nil）
}

// FetchOne 单订阅单次抓取编排（T7 核心）。
//
// 流程（PRD-0005）：
//  1. 解析订阅（按 id，无 userID 校验——调度器是系统行为，非用户操作）
//  2. SetFetchDeps 未注入 → 返回配置错误
//  3. parser.Parse 拉 feed（feed 层错误由调用方 T8 据 SubscriptionError 记失败计数）
//  4. 对每条 entry：去重（FindBySubAndGUID）→ 已处理则跳过
//  5. 新 entry：importer.ImportURL 抓正文 → importer.Create 建草稿
//     - canonical = 订阅 canonical_override 非空则用它，否则 entry.link
//     - auto_publish 决定 draft/published
//  6. 成功：entry.MarkImported(postID) + Save；失败：entry.RecordFailure + Save
//  7. 返回 FetchReport
//
// 不做跨源去重（PRD 已声明）。单条 entry 失败不阻塞其它 entry。
func (s *Service) FetchOne(ctx context.Context, subscriptionID string) FetchReport {
	report := FetchReport{SubscriptionID: subscriptionID}

	if s.entryRepo == nil || s.importer == nil || s.parser == nil {
		report.SubscriptionError = "FetchOne 依赖未注入（entryRepo/importer/parser）"
		return report
	}

	sid, err := shared.ParseID(subscriptionID)
	if err != nil {
		report.SubscriptionError = "无效的订阅 ID：" + err.Error()
		return report
	}
	// 调度器场景：直接按 id 取，不做所有权校验（系统行为，非用户操作）
	sub, err := s.repo.FindByIDForSchedule(ctx, sid)
	if err != nil {
		report.SubscriptionError = "查订阅失败：" + err.Error()
		return report
	}

	items, err := s.parser.Parse(ctx, sub.FeedURL())
	if err != nil {
		report.FeedErr = err // 透传原始 error，T8 调度器据此分类（*FeedError）
		report.SubscriptionError = "feed 拉取失败：" + err.Error()
		return report
	}
	report.FeedEntryCount = len(items)

	for _, item := range items {
		guid := item.GUID
		if guid == "" {
			guid = item.Link // guid 缺失回退 link（去重锚点）
		}
		if guid == "" {
			continue // 无 guid 无 link，无法去重，跳过
		}

		existing, err := s.entryRepo.FindBySubAndGUID(ctx, sid, guid)
		if err != nil {
			report.Failed++
			continue
		}
		if existing != nil && existing.IsProcessed() {
			report.Skipped++
			continue
		}

		// 新 entry 或失败重试中
		entry := existing
		if entry == nil {
			entry = domainentry.NewEntry(sid, guid, item.Link, item.Title, parsePublishedAt(item.PublishedAt), s.now())
		}

		if err := s.fetchAndImport(ctx, sub, item, entry); err != nil {
			entry.RecordFailure(err.Error())
			report.Failed++
			if entry.Status() == domainentry.StatusDead {
				report.Dead++
			}
		} else {
			// 成功：fetchAndImport 内部已 MarkImported 回填 postID
			report.Imported++
		}
		_ = s.entryRepo.Save(ctx, entry)
		if existing == nil {
			report.NewEntries++
		}
	}
	return report
}

// fetchAndImport 抓单条 entry 正文 + 建草稿，回填 entry.postID。
// 成功返回 nil；失败返回 error（调用方 RecordFailure）。
func (s *Service) fetchAndImport(ctx context.Context, sub *domainsubscription.Subscription, item FeedItem, entry *domainentry.SubscriptionEntry) error {
	result, err := s.importer.ImportURL(ctx, item.Link, apppost.ImportURLOpts{})
	if err != nil {
		return fmt.Errorf("抓正文失败: %w", err)
	}
	// canonical：订阅 override 非空则用它，否则 entry.link
	canonical := sub.CanonicalOverride()
	if canonical == "" {
		canonical = item.Link
	}
	canonicalPtr := &canonical

	dto, err := s.importer.Create(ctx, apppost.CreateInput{
		AuthorID:       sub.UserID().String(),
		Title:          firstNonEmpty(result.Title, item.Title, "无标题"),
		Slug:           "", // 让 post.Service 自动生成 slug（按标题）
		ContentMD:      result.Markdown,
		ContentHTML:    result.HTML,
		Excerpt:        result.Excerpt,
		CoverImage:     result.CoverImage,
		SEOTitle:       result.SeoTitle,
		SEODescription: result.SeoDescription,
		CanonicalURL:   canonicalPtr,
		Tags:           sub.Tags(),
	})
	if err != nil {
		return fmt.Errorf("建草稿失败: %w", err)
	}
	// 回填 postID（dto.ID 是字符串）
	if pid, err := shared.ParseID(dto.ID); err == nil {
		entry.MarkImported(pid)
	}
	return nil
}

// parsePublishedAt 解析 RFC3339 发布时间，失败返回 nil。
func parsePublishedAt(s *string) *time.Time {
	if s == nil || *s == "" {
		return nil
	}
	t, err := time.Parse(time.RFC3339, *s)
	if err != nil {
		return nil
	}
	return &t
}

// firstNonEmpty 返回第一个非空字符串。
func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
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
