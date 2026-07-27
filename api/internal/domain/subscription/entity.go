// Package subscription 定义 RSS 订阅源聚合根。
//
// 订阅源是一个长期运行的配置实体：用户/agent 注册一个 RSS feed URL + 抓取频率，
// 后端定时任务按频率拉 feed、解析新 entry、去重、抓正文建草稿（T7/T8 接入）。
// 本期（T6）只做手动 CRUD，不含定时抓取。
//
// 转载语义：订阅抓来的文章 post.canonical_url 默认取 entry.link（feed 自带的源 URL），
// 用户可通过 canonical_override 字段覆盖。
package subscription

import (
	"regexp"
	"time"

	"blog-api/internal/domain/shared"
)

// 订阅源类型（source_type 字段）。本期仅支持 rss，page 为 Phase 2 单页监控预留。
const (
	SourceTypeRSS  = "rss"
	SourceTypePage = "page" // 预留，T6 不实现抓取逻辑
)

// 抓取频率枚举（interval 字段）。固定四档，不引 cron 库（PRD Q4b）。
const (
	IntervalHourly  = "hourly"
	IntervalEvery6h = "every-6h"
	IntervalDaily   = "daily"
	IntervalWeekly  = "weekly"
)

// 订阅状态。active 参与定时调度，paused 不抓（手动暂停或失败计数达阈值自动暂停）。
const (
	StatusActive = "active"
	StatusPaused = "paused"
)

// 失败处理阈值（PRD Q5，Miniflux 共识）。
const (
	// MaxConsecutiveFailures 连续失败达此值自动转 paused。
	MaxConsecutiveFailures = 5
)

var (
	validSourceTypes = map[string]struct{}{
		SourceTypeRSS:  {},
		SourceTypePage: {},
	}
	validIntervals = map[string]struct{}{
		IntervalHourly:  {},
		IntervalEvery6h: {},
		IntervalDaily:   {},
		IntervalWeekly:  {},
	}
	validStatuses = map[string]struct{}{
		StatusActive: {},
		StatusPaused: {},
	}
)

// feedURLPattern feed URL 基础格式校验：http/https + 非空 host。
// 不做 SSRF 预检（那是抓取时的事，由 ssrf 包负责），这里只挡明显非法输入。
var feedURLPattern = regexp.MustCompile(`^https?://[^\s/$.?#].[^\s]*$`)

// IsValidSourceType 判断 source_type 是否合法。
func IsValidSourceType(s string) bool {
	_, ok := validSourceTypes[s]
	return ok
}

// IsValidInterval 判断 interval 是否合法。
func IsValidInterval(s string) bool {
	_, ok := validIntervals[s]
	return ok
}

// IsValidStatus 判断 status 是否合法。
func IsValidStatus(s string) bool {
	_, ok := validStatuses[s]
	return ok
}

// IsValidFeedURL 判断 feed URL 基础格式（http/https + 非空 host）。
func IsValidFeedURL(rawURL string) bool {
	return feedURLPattern.MatchString(rawURL)
}

// IntervalDuration 把 interval 枚举转成实际时间间隔。
// 未知值回退到 daily（保守，不致盲抓）。
func IntervalDuration(interval string) time.Duration {
	switch interval {
	case IntervalHourly:
		return time.Hour
	case IntervalEvery6h:
		return 6 * time.Hour
	case IntervalDaily:
		return 24 * time.Hour
	case IntervalWeekly:
		return 7 * 24 * time.Hour
	default:
		return 24 * time.Hour
	}
}

// Subscription 订阅源聚合根。
//
// 不变量：
//   - feedURL 创建后永不变（改源 = 删旧建新；Update 不暴露此字段）
//   - status 仅在 active/paused 之间迁移，由 RecordSuccess/RecordFailure/Pause/Resume 维护
//   - consecutiveFailures 仅在 active 状态累积；成功或手动恢复清零
//   - nextFetchAt 由 RecordSuccess/RecordFailure 推进，调度器据此判断 due
type Subscription struct {
	shared.AggregateRoot

	id                  shared.ID
	userID              shared.ID
	sourceType          string // 'rss'（默认）/ 'page'（预留）
	feedURL             string
	title               string // 订阅源标题（feed 解析或用户填）
	interval            string // hourly/every-6h/daily/weekly
	autoPublish         bool   // 抓来是否自动发布（默认 false，建草稿）
	canonicalOverride   string // 覆盖 entry.link 作为 canonical；空=用 entry.link
	tags                []string
	status              string // active/paused
	consecutiveFailures int
	lastError           string
	lastFetchedAt       *time.Time
	nextFetchAt         *time.Time
	retryAfterUntil     *time.Time // 尊重 429 Retry-After，此时间前不抓
	createdAt           time.Time
	updatedAt           time.Time
}

// NewSubscription 创建新订阅（active 状态，nextFetchAt = now + interval）。
// feedURL 仅做基础格式校验；SSRF/可达性由抓取时（T7/T8）负责。
func NewSubscription(userID shared.ID, feedURL, title, interval string, now time.Time) (*Subscription, error) {
	if !IsValidFeedURL(feedURL) {
		return nil, shared.BadRequest("feed URL 格式无效（需 http/https + 非空 host）")
	}
	if !IsValidInterval(interval) {
		return nil, shared.BadRequest("无效的抓取频率：" + interval)
	}
	next := now.Add(IntervalDuration(interval))
	return &Subscription{
		id:          shared.NewID(),
		userID:      userID,
		sourceType:  SourceTypeRSS, // 本期固定 rss
		feedURL:     feedURL,
		title:       title,
		interval:    interval,
		autoPublish: false,
		tags:        []string{},
		status:      StatusActive,
		nextFetchAt: &next,
		createdAt:   now,
		updatedAt:   now,
	}, nil
}

// Reconstruct 从持久化数据重建（无校验、无副作用、无默认值填充）。
func Reconstruct(
	id, userID shared.ID,
	sourceType, feedURL, title, interval string,
	autoPublish bool,
	canonicalOverride string,
	tags []string,
	status string,
	consecutiveFailures int,
	lastError string,
	lastFetchedAt, nextFetchAt, retryAfterUntil *time.Time,
	createdAt, updatedAt time.Time,
) *Subscription {
	if tags == nil {
		tags = []string{}
	}
	return &Subscription{
		id:                  id,
		userID:              userID,
		sourceType:          sourceType,
		feedURL:             feedURL,
		title:               title,
		interval:            interval,
		autoPublish:         autoPublish,
		canonicalOverride:   canonicalOverride,
		tags:                tags,
		status:              status,
		consecutiveFailures: consecutiveFailures,
		lastError:           lastError,
		lastFetchedAt:       lastFetchedAt,
		nextFetchAt:         nextFetchAt,
		retryAfterUntil:     retryAfterUntil,
		createdAt:           createdAt,
		updatedAt:           updatedAt,
	}
}

// --- 配置变更方法（Update 调用） ---

// UpdateConfig 更新可配置字段（不改 feedURL/status/失败计数等运行态字段）。
func (s *Subscription) UpdateConfig(title, interval string, autoPublish bool, canonicalOverride string, tags []string) error {
	if !IsValidInterval(interval) {
		return shared.BadRequest("无效的抓取频率：" + interval)
	}
	s.title = title
	s.interval = interval
	s.autoPublish = autoPublish
	s.canonicalOverride = canonicalOverride
	if tags == nil {
		tags = []string{}
	}
	s.tags = tags
	return nil
}

// --- 状态迁移方法（运行态，T8 调度器调） ---

// Pause 手动暂停。
func (s *Subscription) Pause() {
	s.status = StatusPaused
}

// Resume 手动恢复：清零失败计数回到 active。nextFetchAt 不动（调度器下一轮自然 due）。
func (s *Subscription) Resume() {
	s.consecutiveFailures = 0
	s.lastError = ""
	s.status = StatusActive
}

// RecordSuccess 抓取成功：清零失败计数，推进 nextFetchAt = now + interval。
// 调用方负责更新 lastFetchedAt（持久化层在 Save 时取实体当前值）。
func (s *Subscription) RecordSuccess(now time.Time) {
	s.consecutiveFailures = 0
	s.lastError = ""
	s.lastFetchedAt = &now
	next := now.Add(IntervalDuration(s.interval))
	s.nextFetchAt = &next
}

// RecordFailure 抓取失败：累积失败计数，达阈值自动 paused。
// 永久错误（4xx/malformed XML）应直接调 Pause 而非此方法。
// 返回是否触发了自动暂停（便于调度器记日志/通知）。
func (s *Subscription) RecordFailure(now time.Time, reason string) bool {
	s.consecutiveFailures++
	s.lastError = reason
	s.lastFetchedAt = &now
	// 失败仍推进下次尝试（保守用原 interval；未来可指数退避）
	next := now.Add(IntervalDuration(s.interval))
	s.nextFetchAt = &next
	if s.consecutiveFailures >= MaxConsecutiveFailures {
		s.status = StatusPaused
		return true
	}
	return false
}

// SetRetryAfter 收到 429 + Retry-After 时推迟下次抓取，不增失败计数（PRD Q5）。
func (s *Subscription) SetRetryAfter(until time.Time) {
	s.retryAfterUntil = &until
}

// IsDue 判断当前是否该抓（调度器查询条件）。
// due = status==active && nextFetchAt <= now && (retryAfterUntil 为空或已过)。
func (s *Subscription) IsDue(now time.Time) bool {
	if s.status != StatusActive {
		return false
	}
	if s.nextFetchAt == nil || s.nextFetchAt.After(now) {
		return false
	}
	if s.retryAfterUntil != nil && s.retryAfterUntil.After(now) {
		return false
	}
	return true
}

// --- 访问器 ---

func (s *Subscription) ID() shared.ID           { return s.id }
func (s *Subscription) UserID() shared.ID       { return s.userID }
func (s *Subscription) SourceType() string      { return s.sourceType }
func (s *Subscription) FeedURL() string         { return s.feedURL }
func (s *Subscription) Title() string           { return s.title }
func (s *Subscription) Interval() string        { return s.interval }
func (s *Subscription) AutoPublish() bool       { return s.autoPublish }
func (s *Subscription) CanonicalOverride() string { return s.canonicalOverride }
func (s *Subscription) Tags() []string          { return s.tags }
func (s *Subscription) Status() string          { return s.status }
func (s *Subscription) ConsecutiveFailures() int { return s.consecutiveFailures }
func (s *Subscription) LastError() string       { return s.lastError }
func (s *Subscription) LastFetchedAt() *time.Time { return s.lastFetchedAt }
func (s *Subscription) NextFetchAt() *time.Time   { return s.nextFetchAt }
func (s *Subscription) RetryAfterUntil() *time.Time { return s.retryAfterUntil }
func (s *Subscription) CreatedAt() time.Time    { return s.createdAt }
func (s *Subscription) UpdatedAt() time.Time    { return s.updatedAt }
