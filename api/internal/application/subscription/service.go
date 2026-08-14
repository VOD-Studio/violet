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
	"errors"
	"fmt"
	"time"

	"github.com/rs/zerolog/log"

	appshared "blog-api/internal/application/shared"
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
	bus       appshared.EventBus
	entryRepo domainentry.EntryRepository
	importer  PostImporter
	parser    FeedParser
}

// NewService 构造服务。now 为 nil 时用 time.Now；bus 为 nil 时不发布事件（CRUD-only 测试场景）。
func NewService(repo domainsubscription.SubscriptionRepository, now func() time.Time, bus appshared.EventBus) *Service {
	if now == nil {
		now = time.Now
	}
	return &Service{repo: repo, now: now, bus: bus}
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
// UserID：admin 视角标识归属者；用户视角即调用者本人，无额外暴露。
type SubscriptionDTO struct {
	ID                 string   `json:"id"`
	UserID             string   `json:"user_id,omitempty"`
	FeedURL            string   `json:"feed_url"`
	Title              string   `json:"title"`
	SourceType         string   `json:"source_type"`
	Interval           string   `json:"interval"`
	AutoPublish        bool     `json:"auto_publish"`
	CanonicalOverride  string   `json:"canonical_override,omitempty"`
	Tags               []string `json:"tags"`
	Status             string   `json:"status"` // 状态：active（参与定时调度）/paused（手动暂停或失败计数达阈值自动暂停）
	ConsecutiveFailures int     `json:"consecutive_failures"`
	LastError          string   `json:"last_error,omitempty"` // 最近一次抓取失败原因；空串=无错误
	LastFetchedAt      string   `json:"last_fetched_at,omitempty"` // RFC3339
	NextFetchAt        string   `json:"next_fetch_at,omitempty"` // 下次抓取时间（RFC3339）；空串=未排程（paused 态或重建兜底）
	RetryAfterUntil    string   `json:"retry_after_until,omitempty"` // 429 Retry-After 延迟截止时间（RFC3339）；空串=无延迟限制
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
	s.publishEvents(ctx, sub)
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
	return s.list(ctx, status, page, limit, userID)
}

// ListAll 列出全站订阅（admin 后台用，跨用户）。
func (s *Service) ListAll(ctx context.Context, status string, page, limit int) ([]SubscriptionDTO, int64, error) {
	return s.list(ctx, status, page, limit, "")
}

// list 是 ListByUser/ListAll 的共享实现。userFilter 空串 = 不过滤用户（全站）。
func (s *Service) list(ctx context.Context, status string, page, limit int, userFilter string) ([]SubscriptionDTO, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	var (
		subs  []*domainsubscription.Subscription
		total int64
		err   error
	)
	if userFilter == "" {
		subs, total, err = s.repo.FindAll(ctx, status, page, limit)
	} else {
		uid, perr := shared.ParseID(userFilter)
		if perr != nil {
			return nil, 0, perr
		}
		subs, total, err = s.repo.FindByUser(ctx, uid, status, page, limit)
	}
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
	if err := s.repo.Save(ctx, sub); err != nil {
		return err
	}
	s.publishEvents(ctx, sub)
	return nil
}

func (s *Service) Pause(ctx context.Context, id, userID string) error {
	sub, err := s.findByID(ctx, id, userID)
	if err != nil {
		return err
	}
	sub.Pause()
	if err := s.repo.Save(ctx, sub); err != nil {
		return err
	}
	s.publishEvents(ctx, sub)
	return nil
}

func (s *Service) Resume(ctx context.Context, id, userID string) error {
	sub, err := s.findByID(ctx, id, userID)
	if err != nil {
		return err
	}
	sub.Resume()
	if err := s.repo.Save(ctx, sub); err != nil {
		return err
	}
	s.publishEvents(ctx, sub)
	return nil
}

// Delete 删除订阅（连带其 entries 在 T7 加表后由 ON DELETE CASCADE 处理）。
// 删除前加载订阅取 title 快照，删除后手动发布事件（聚合根已不可用）。
func (s *Service) Delete(ctx context.Context, id, userID string) error {
	sub, err := s.findByID(ctx, id, userID)
	if err != nil {
		return err
	}
	title := sub.Title()
	if err := s.repo.Delete(ctx, sub.ID(), sub.UserID()); err != nil {
		return err
	}
	s.publish(ctx, domainsubscription.NewSubscriptionDeleted(sub.ID(), title))
	return nil
}

// --- admin 视角用例（后台订阅管理，跨用户不校验所有权） ---

// AdminUpdateInput admin 更新订阅配置入参。
// 部分更新语义：指针字段 nil = 保持原值，非 nil = 覆盖；Tags nil = 保持原值。
type AdminUpdateInput struct {
	ID                string
	Title             *string
	Interval          *string // 抓取频率（hourly/every-6h/daily/weekly）；nil=保留原值（PATCH 语义，非 nil 覆盖）
	AutoPublish       *bool
	CanonicalOverride *string
	Tags              []string
}

// GetByIDForAdmin 查单个订阅（admin 后台用，跨用户不校验所有权）。
func (s *Service) GetByIDForAdmin(ctx context.Context, id string) (SubscriptionDTO, error) {
	sub, err := s.findByIDForAdmin(ctx, id)
	if err != nil {
		return SubscriptionDTO{}, err
	}
	return toDTO(sub), nil
}

// UpdateForAdmin 更新订阅配置（admin 后台用，部分更新：nil 字段保持原值）。
func (s *Service) UpdateForAdmin(ctx context.Context, in AdminUpdateInput) (SubscriptionDTO, error) {
	sub, err := s.findByIDForAdmin(ctx, in.ID)
	if err != nil {
		return SubscriptionDTO{}, err
	}
	// 部分更新合并：nil 保持原值，非 nil 覆盖
	title := sub.Title()
	if in.Title != nil {
		title = *in.Title
	}
	interval := ""
	if in.Interval != nil {
		interval = *in.Interval
	}
	autoPublish := sub.AutoPublish()
	if in.AutoPublish != nil {
		autoPublish = *in.AutoPublish
	}
	canonical := sub.CanonicalOverride()
	if in.CanonicalOverride != nil {
		canonical = *in.CanonicalOverride
	}
	tags := sub.Tags()
	if in.Tags != nil {
		tags = in.Tags
	}
	if err := sub.UpdateConfig(title, interval, autoPublish, canonical, tags); err != nil {
		return SubscriptionDTO{}, err
	}
	if err := s.repo.Save(ctx, sub); err != nil {
		return SubscriptionDTO{}, err
	}
	s.publishEvents(ctx, sub)
	return toDTO(sub), nil
}

// PauseForAdmin 手动暂停订阅（admin 后台用，跨用户不校验所有权）。
func (s *Service) PauseForAdmin(ctx context.Context, id string) (SubscriptionDTO, error) {
	sub, err := s.findByIDForAdmin(ctx, id)
	if err != nil {
		return SubscriptionDTO{}, err
	}
	sub.Pause()
	if err := s.repo.Save(ctx, sub); err != nil {
		return SubscriptionDTO{}, err
	}
	s.publishEvents(ctx, sub)
	return toDTO(sub), nil
}

// ResumeForAdmin 手动恢复订阅（admin 后台用，清零失败计数回 active）。
func (s *Service) ResumeForAdmin(ctx context.Context, id string) (SubscriptionDTO, error) {
	sub, err := s.findByIDForAdmin(ctx, id)
	if err != nil {
		return SubscriptionDTO{}, err
	}
	sub.Resume()
	if err := s.repo.Save(ctx, sub); err != nil {
		return SubscriptionDTO{}, err
	}
	s.publishEvents(ctx, sub)
	return toDTO(sub), nil
}

// DeleteForAdmin 删除订阅（admin 后台用，跨用户不校验所有权）。
// 连带 entries 由 ON DELETE CASCADE 处理。删除后手动发布事件（聚合根已不可用）。
func (s *Service) DeleteForAdmin(ctx context.Context, id string) error {
	sub, err := s.findByIDForAdmin(ctx, id)
	if err != nil {
		return err
	}
	title := sub.Title()
	if err := s.repo.Delete(ctx, sub.ID(), sub.UserID()); err != nil {
		return err
	}
	s.publish(ctx, domainsubscription.NewSubscriptionDeleted(sub.ID(), title))
	return nil
}

// findByIDForAdmin 解析 ID + FindByIDForSchedule（admin 视角，无所有权校验）。
func (s *Service) findByIDForAdmin(ctx context.Context, id string) (*domainsubscription.Subscription, error) {
	sid, err := shared.ParseID(id)
	if err != nil {
		return nil, err
	}
	return s.repo.FindByIDForSchedule(ctx, sid)
}

// --- 事件发布辅助 ---

// publishEvents 发布聚合根累积的领域事件（审计订阅者消费）。
// bus 为 nil 时静默跳过（CRUD-only 测试场景）。
func (s *Service) publishEvents(ctx context.Context, sub *domainsubscription.Subscription) {
	if s.bus == nil {
		return
	}
	events := sub.PullEvents()
	if len(events) == 0 {
		return
	}
	if err := s.bus.Publish(ctx, events); err != nil {
		log.Warn().Err(err).Msg("发布订阅事件失败")
	}
}

// publish 发布单个手动构造的事件（用于删除等聚合根已不可用的场景）。
func (s *Service) publish(ctx context.Context, event shared.DomainEvent) {
	if s.bus == nil {
		return
	}
	if err := s.bus.Publish(ctx, []shared.DomainEvent{event}); err != nil {
		log.Warn().Err(err).Msg("发布订阅事件失败")
	}
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
	FeedErr           *FeedError // 结构化 feed 错误，T8 据此分类；非 feed 错误为 nil
	FeedTitle         string    // feed 级标题（Parse 成功时非空），供 FetchNow 回填事件 title
}

// FetchOne 单订阅单次抓取编排（T7 核心）。
//
// 流程（PRD-0005）：
//  1. 解析订阅（按 id，无 userID 校验——调度器是系统行为，非用户操作）
//  2. SetFetchDeps 未注入 → 返回配置错误
//  3. parser.Parse 拉 feed（feed 层错误由调用方 T8 据 SubscriptionError 记失败计数）
//     - 订阅 title 为空且 feed 有标题时回填（保留其它配置，失败忽略）
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

	feedTitle, items, err := s.parser.Parse(ctx, sub.FeedURL())
	if err != nil {
		// 提取 *FeedError 给 T8 分类；非 FeedError 时 FeedErr=nil（T8 当瞬时错误处理）
		var fe *FeedError
		if errors.As(err, &fe) {
			report.FeedErr = fe
		}
		report.SubscriptionError = "feed 拉取失败：" + err.Error()
		return report
	}
	report.FeedEntryCount = len(items)
	report.FeedTitle = feedTitle

	// title 回填：创建订阅时未指定标题，用 feed 级标题补齐（首次抓取触发）。
	// 其它配置（autoPublish/canonicalOverride/tags）须传现值，UpdateConfig 全量覆盖。
	// 回填失败不阻塞抓取也不计入失败计数（下一轮抓取会再试）。
	if feedTitle != "" && sub.Title() == "" {
		if err := sub.UpdateConfig(feedTitle, "", sub.AutoPublish(), sub.CanonicalOverride(), sub.Tags()); err == nil {
			_ = s.repo.Save(ctx, sub) // 保存失败忽略：回填是锦上添花，不进 SubscriptionError
		}
	}

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

		var imported, dead bool
		if err := s.fetchAndImport(ctx, sub, item, entry); err != nil {
			dead = entry.RecordFailure(err.Error())
			report.Failed++
			if dead {
				report.Dead++
			}
		} else {
			// 成功：fetchAndImport 内部已 MarkImported 回填 postID。
			// 计数与失败路径对称地立即 ++，Save 失败回退才不为负。
			imported = true
			report.Imported++
		}
		// 持久化 entry 状态；失败时回退本轮计数（未真落地，下轮重试按旧状态）
		if err := s.entryRepo.Save(ctx, entry); err != nil {
			if imported {
				report.Imported-- // 回退：实际没落地
			} else {
				report.Failed--
				if dead {
					report.Dead--
				}
			}
			// Save 失败记到整轮错误（非致命，其它 entry 继续）
			if report.SubscriptionError == "" {
				report.SubscriptionError = "部分条目持久化失败：" + err.Error()
			}
			continue
		}
		if existing == nil {
			report.NewEntries++
		}
	}
	return report
}

// defaultRateLimitBackoff 429 无 Retry-After 头时的默认退避时长。
// 源站限流却不给重试时间时，按 1h 推迟避免每轮照打。
const defaultRateLimitBackoff = time.Hour

// FetchNow 立即拉取一次订阅：查订阅 → FetchOne → 据报告更新订阅运行态 → Save → 发布抓取事件。
//
// 把"抓取 + 状态更新 + 审计"的完整编排收敛在 application 层，供调度器（job）与
// 手动触发（admin 端点）共用，避免状态更新逻辑分散在调用方导致不一致。
//
// isSystem 区分触发来源：true=调度器自动（actor_type=system），false=手动（actor_type=user）。
// 审计订阅者据此设置 ActorType（业界共识：区分真人与系统自动化）。
//
// FetchOne 只抓 entry 建草稿，不碰订阅运行态（nextFetchAt/失败计数）——
// 那是 FetchNow 的职责：据 FetchReport 跑失败状态机（applyFeedError）。
func (s *Service) FetchNow(ctx context.Context, subscriptionID string, isSystem bool) FetchReport {
	report := FetchReport{SubscriptionID: subscriptionID}

	sid, err := shared.ParseID(subscriptionID)
	if err != nil {
		report.SubscriptionError = "无效的订阅 ID：" + err.Error()
		return report
	}
	sub, err := s.repo.FindByIDForSchedule(ctx, sid)
	if err != nil {
		report.SubscriptionError = "查订阅失败：" + err.Error()
		return report
	}

	report = s.FetchOne(ctx, subscriptionID)

	now := s.now()
	autoPaused := false
	if report.SubscriptionError == "" {
		// feed 拉取成功（即便部分 entry 失败，feed 层算成功）→ 清零计数 + 推进 next_fetch_at
		sub.RecordSuccess(now)
	} else {
		// 自动暂停信号用状态差分捕获：applyFeedError 内部（永久错误直接 Pause 或
		// 瞬时错误 RecordFailure 达阈值）把 active 转为 paused 即本轮触发。
		wasActive := sub.Status() == domainsubscription.StatusActive
		s.applyFeedError(sub, report.FeedErr, now, report.SubscriptionError)
		autoPaused = wasActive && sub.Status() == domainsubscription.StatusPaused
	}
	if err := s.repo.Save(ctx, sub); err != nil {
		if report.SubscriptionError == "" {
			report.SubscriptionError = "订阅状态回写失败：" + err.Error()
		}
	}
	// 操作日志的成功语义:整轮无失败(feed 无错误 且 无条目失败)。
	// 与订阅健康度判定不同——后者只看 feed 错误(applyFeedError),部分条目失败不暂停订阅。
	// 条目失败时 error 描述失败条数,避免日志出现 success=true + failed=N 的误导组合。
	success := report.SubscriptionError == "" && report.Failed == 0
	errMsg := report.SubscriptionError
	if !success && report.SubscriptionError == "" {
		errMsg = fmt.Sprintf("%d 条条目导入失败", report.Failed)
	}
	// title 优先用 sub.Title()（已回填或用户指定）；为空时用本轮 feed 标题；仍空用 URL 兜底。
	// FetchOne 内部回填的 title 只更新了它自己的 sub 实例，此处 sub 是独立加载的，
	// 可能仍是空 title——用 report.FeedTitle 补上，避免通知显示「订阅「」抓取完成」。
	title := sub.Title()
	if title == "" {
		title = report.FeedTitle
	}
	if title == "" {
		title = sub.FeedURL()
	}
	s.publish(ctx, domainsubscription.NewSubscriptionFetched(
		sub.ID(), title, success, report.Imported, report.Failed,
		errMsg, feedErrorKindString(report.FeedErr), isSystem, autoPaused,
	))
	return report
}

// feedErrorKindString 把结构化 FeedError 分类映射为 domain 事件用的 string。
// FeedErr 为 nil（非 feed 层错误，如查订阅失败）时返回空串。
func feedErrorKindString(fe *FeedError) string {
	if fe == nil {
		return ""
	}
	switch fe.Kind {
	case FeedErrTransient:
		return domainsubscription.FeedErrKindTransient
	case FeedErrPermanent:
		return domainsubscription.FeedErrKindPermanent
	case FeedErrRateLimited:
		return domainsubscription.FeedErrKindRateLimited
	}
	return ""
}

// applyFeedError 据 FeedError 分类更新订阅状态（PRD Q5 Miniflux 共识）：
//   - RateLimited (429)：推迟 retry_after_until，不增计数。
//     无 Retry-After 头时用默认退避 defaultRateLimitBackoff，避免每轮照打不收敛。
//   - Permanent (4xx/malformed)：立即 Pause
//   - Transient (5xx/网络)：RecordFailure 计数，达阈值自动 paused
//
// feedErr 为 nil（非 *FeedError，如 FindByID 失败）时按瞬时错误处理。
func (s *Service) applyFeedError(sub *domainsubscription.Subscription, feedErr *FeedError, now time.Time, desc string) {
	if feedErr != nil {
		switch feedErr.Kind {
		case FeedErrRateLimited:
			until := feedErr.RetryAfter
			if until == nil {
				// 429 但无 Retry-After 头：默认退避 1h，否则不推迟不增计数，每轮照打源站不收敛
				def := now.Add(defaultRateLimitBackoff)
				until = &def
			}
			sub.SetRetryAfter(*until)
			return
		case FeedErrPermanent:
			sub.Pause()
			return
		case FeedErrTransient:
			// 落到下面 RecordFailure
		}
	}

	// 默认/瞬时错误：累积失败计数
	sub.RecordFailure(now, desc)
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
	// auto_publish=true：发布草稿（订阅创建时已校验 PAT 持 posts:publish scope，见 T6 review 意见 2）
	if sub.AutoPublish() {
		if err := s.importer.Publish(ctx, dto.ID); err != nil {
			return fmt.Errorf("自动发布失败: %w", err)
		}
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
		UserID:              s.UserID().String(),
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
