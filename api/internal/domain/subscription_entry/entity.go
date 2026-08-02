// Package subscription_entry 定义订阅源条目聚合根。
//
// 条目是 feed 里单篇文章的处理记录：每次 FetchOne 拉 feed 后，对每条 entry 查
// 此表过滤已处理（(subscription_id, guid) UNIQUE 保证幂等）。新建草稿后回填 post_id，
// 抓取失败累积 fail_count，达 3 次标记 dead 不再重试（PRD Q5）。
//
// 状态机：pending（首次记录）→ imported（建草稿成功）/ failed（抓取失败，可重试）
//
//	→ dead（fail_count 达上限，不再重试）
package subscription_entry

import (
	"time"

	"blog-api/internal/domain/shared"
)

// 条目状态。
const (
	StatusPending  = "pending"  // 已记录但未处理（首次见到的 entry）
	StatusImported = "imported" // 建草稿成功，post_id 已回填
	StatusFailed   = "failed"   // 抓取失败，可重试（fail_count < 上限）
	StatusDead     = "dead"     // fail_count 达上限，不再重试
)

// MaxFailCount 抓取失败达此值标记 dead（PRD Q5：entry 补抓上限 3 次）。
const MaxFailCount = 3

// SubscriptionEntry 订阅源条目聚合根。
type SubscriptionEntry struct {
	shared.AggregateRoot

	// id 条目主键（自增；领域对象创建时为 0，持久化后由 SetID 回填）
	id int64
	// subscriptionID 所属订阅源 ID
	subscriptionID shared.ID
	// guid entry 的 guid（无则回退 link），与 subscriptionID 组成 UNIQUE 去重锚点
	guid string
	// entryURL entry.link 源文章 URL
	entryURL string
	// title 条目标题（源文章标题快照）
	title string
	// postID 建草稿成功后回填的草稿文章 ID（导入前为 nil）
	postID *shared.ID
	// status 状态：pending（首次记录）/ imported（建草稿成功）/ failed（抓取失败可重试）/ dead（达上限不再重试）
	status string
	// failCount 连续抓取失败次数（达 MaxFailCount 标记 dead）
	failCount int
	// lastError 最近一次抓取失败原因（dead 后保留最后一次错误供排查）
	lastError string
	// publishedAt 源文章发布时间（可空）
	publishedAt *time.Time
	// createdAt 首次记录该条目的时间
	createdAt time.Time
}

// NewEntry 创建首次见到的条目（pending 状态）。
func NewEntry(subscriptionID shared.ID, guid, entryURL, title string, publishedAt *time.Time, now time.Time) *SubscriptionEntry {
	return &SubscriptionEntry{
		id:             0, // DB 自增
		subscriptionID: subscriptionID,
		guid:           guid,
		entryURL:       entryURL,
		title:          title,
		status:         StatusPending,
		publishedAt:    publishedAt,
		createdAt:      now,
	}
}

// Reconstruct 从持久化数据重建（无校验）。
func Reconstruct(
	id int64,
	subscriptionID shared.ID,
	guid, entryURL, title string,
	postID *shared.ID,
	status string,
	failCount int,
	lastError string,
	publishedAt *time.Time,
	createdAt time.Time,
) *SubscriptionEntry {
	return &SubscriptionEntry{
		id:             id,
		subscriptionID: subscriptionID,
		guid:           guid,
		entryURL:       entryURL,
		title:          title,
		postID:         postID,
		status:         status,
		failCount:      failCount,
		lastError:      lastError,
		publishedAt:    publishedAt,
		createdAt:      createdAt,
	}
}

// MarkImported 建草稿成功：回填 post_id，状态转 imported，清错误。
func (e *SubscriptionEntry) MarkImported(postID shared.ID) {
	e.postID = &postID
	e.status = StatusImported
	e.lastError = ""
}

// RecordFailure 抓取失败：累积 fail_count，达上限标记 dead。
// 返回是否触发 dead（便于调用方记日志）。
func (e *SubscriptionEntry) RecordFailure(reason string) bool {
	e.failCount++
	e.lastError = reason
	if e.failCount >= MaxFailCount {
		e.status = StatusDead
		return true
	}
	e.status = StatusFailed
	return false
}

// IsProcessed 是否已处理完（imported 或 dead，都不再重试）。
func (e *SubscriptionEntry) IsProcessed() bool {
	return e.status == StatusImported || e.status == StatusDead
}

// SetID 回写持久化层自增主键（仅 repo.Save 在首次创建后调用）。
// 领域对象创建时 id=0，DB 分配自增 id 后由此回填，避免后续 Save 误当新建撞 UNIQUE。
func (e *SubscriptionEntry) SetID(id int64) {
	e.id = id
}

// --- 访问器 ---

func (e *SubscriptionEntry) ID() int64                 { return e.id }
func (e *SubscriptionEntry) SubscriptionID() shared.ID { return e.subscriptionID }
func (e *SubscriptionEntry) GUID() string              { return e.guid }
func (e *SubscriptionEntry) EntryURL() string          { return e.entryURL }
func (e *SubscriptionEntry) Title() string             { return e.title }
func (e *SubscriptionEntry) PostID() *shared.ID        { return e.postID }
func (e *SubscriptionEntry) Status() string            { return e.status }
func (e *SubscriptionEntry) FailCount() int            { return e.failCount }
func (e *SubscriptionEntry) LastError() string         { return e.lastError }
func (e *SubscriptionEntry) PublishedAt() *time.Time   { return e.publishedAt }
func (e *SubscriptionEntry) CreatedAt() time.Time      { return e.createdAt }
