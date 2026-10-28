// Package linkpreview 提供链接预览卡片（OG 卡片）领域模型。
//
// 按 URL 去重的共享缓存：推文、评论等任何内容引用同一 URL 只有一行，
// TTL 过期或失败退避结束后由应用层在下次被读取时触发重抓（惰性刷新）。
package linkpreview

import (
	"fmt"
	"strings"
	"time"

	"blog-api/internal/domain/shared"
)

// Status 卡片抓取状态机。
type Status string

const (
	// StatusPending 已登记未完成首次抓取。
	StatusPending Status = "pending"
	// StatusOK 抓取成功（含"重抓失败但保留旧快照"的卡片）。
	StatusOK Status = "ok"
	// StatusFailed 首次抓取失败且从未成功过。
	StatusFailed Status = "failed"
)

const (
	// DefaultTTL 成功快照的有效期；过期后下次被读取触发重抓。
	DefaultTTL = 7 * 24 * time.Hour
	// FailureBackoffBase 失败后的基础退避；随连续失败次数指数增长。
	FailureBackoffBase = 24 * time.Hour
	// MaxLastError 持久化的错误摘要上限，防止异常响应撑爆字段。
	MaxLastError = 200
)

// LinkCard 单个规范化 URL 的预览卡片缓存。
//
// 不变量：
//   - url 非空且全局唯一（跨内容共享）
//   - status=failed 时必然从无成功快照（HasSnapshot 为 false）
//   - expiresAt 兼作重抓调度点：成功后为 now+TTL，失败后为 now+退避
//   - 重抓失败不删除已有快照：status=ok 的卡片保留旧数据继续展示
type LinkCard struct {
	id shared.ID
	// url 规范化后的原文 URL（小写主机、去默认端口），全局唯一键
	url string
	// title 卡片标题：og:title / twitter:title / <title> 逐级回退，可空
	title string
	// description 卡片描述：og:description / twitter:description / meta description 回退，可空
	description string
	// siteName 来源站点名（og:site_name），可空
	siteName string
	// imageURL 封面图本站访问路径（/uploads/link-previews/...），下载失败为空串
	imageURL string
	// status 抓取状态机（pending/ok/failed）
	status Status
	// fetchedAt 最近一次抓取尝试时间（无论成败）
	fetchedAt time.Time
	// expiresAt 快照有效期 / 失败退避结束点，到达后下次读取触发重抓
	expiresAt time.Time
	// lastError 脱敏后的最近一次失败摘要（不含目标站响应体）
	lastError string
	// failCount 连续失败次数，成功后清零；决定指数退避长度
	failCount int
	// timestamps 创建/更新时间
	timestamps shared.Timestamps
}

// NewLinkCard 登记一个待抓取的 URL（status=pending，expiresAt=now 立即可抓）。
func NewLinkCard(id shared.ID, url string, now time.Time) (*LinkCard, error) {
	if strings.TrimSpace(url) == "" {
		return nil, shared.Validation("链接卡片 URL 不能为空")
	}
	return &LinkCard{
		id:        id,
		url:       url,
		status:    StatusPending,
		fetchedAt: now,
		expiresAt: now,
		timestamps: shared.Timestamps{
			CreatedAt: now,
			UpdatedAt: now,
		},
	}, nil
}

// ReconstructLinkCard 从持久化数据重建（宽高字段由仓储层保证语义）。
func ReconstructLinkCard(
	id shared.ID, url, title, description, siteName, imageURL string,
	status Status, fetchedAt, expiresAt time.Time, lastError string, failCount int,
	createdAt, updatedAt time.Time,
) *LinkCard {
	return &LinkCard{
		id: id, url: url, title: title, description: description,
		siteName: siteName, imageURL: imageURL, status: status,
		fetchedAt: fetchedAt, expiresAt: expiresAt, lastError: lastError,
		failCount:  failCount,
		timestamps: shared.Timestamps{CreatedAt: createdAt, UpdatedAt: updatedAt},
	}
}

// NeedRefresh 是否应触发重抓：TTL 或退避已到点。
// 从未抓取（pending）与失败中的卡片都由本方法统一调度。
func (c *LinkCard) NeedRefresh(now time.Time) bool {
	return !now.Before(c.expiresAt)
}

// HasSnapshot 是否存在可展示的快照数据（任一字段非空）。
func (c *LinkCard) HasSnapshot() bool {
	return c.title != "" || c.description != "" || c.imageURL != ""
}

// Displayable 是否对消费方展示卡片：有成功快照且 status=ok。
// failed 表示从未成功，没有可展示内容。
func (c *LinkCard) Displayable() bool {
	return c.status == StatusOK && c.HasSnapshot()
}

// RecordSuccess 记录一次成功抓取：写入快照、清零失败计数、按 ttl 顺延有效期。
func (c *LinkCard) RecordSuccess(title, description, siteName, imageURL string, now time.Time, ttl time.Duration) {
	c.title, c.description, c.siteName, c.imageURL = title, description, siteName, imageURL
	c.status = StatusOK
	c.failCount = 0
	c.lastError = ""
	c.fetchedAt = now
	c.expiresAt = now.Add(ttl)
	c.touch(now)
}

// RecordFailure 记录一次失败：指数退避（base*2^(n-1)，封顶 7 天），保留旧快照。
//
// status=ok 的卡片重抓失败时保持 ok（旧快照继续展示）；
// pending/failed 的卡片失败后进入 failed（从未成功，不展示）。
func (c *LinkCard) RecordFailure(errMsg string, now time.Time) {
	c.failCount++
	backoff := FailureBackoffBase << min(c.failCount-1, 5)
	if backoff > DefaultTTL {
		backoff = DefaultTTL
	}
	c.lastError = truncate(errMsg, MaxLastError)
	c.fetchedAt = now
	c.expiresAt = now.Add(backoff)
	if c.status != StatusOK {
		c.status = StatusFailed
	}
	c.touch(now)
}

func (c *LinkCard) touch(now time.Time) {
	c.timestamps.UpdatedAt = now
}

func (c *LinkCard) ID() shared.ID        { return c.id }
func (c *LinkCard) URL() string          { return c.url }
func (c *LinkCard) Title() string        { return c.title }
func (c *LinkCard) Description() string  { return c.description }
func (c *LinkCard) SiteName() string     { return c.siteName }
func (c *LinkCard) ImageURL() string     { return c.imageURL }
func (c *LinkCard) Status() Status       { return c.status }
func (c *LinkCard) FetchedAt() time.Time { return c.fetchedAt }
func (c *LinkCard) ExpiresAt() time.Time { return c.expiresAt }
func (c *LinkCard) LastError() string    { return c.lastError }
func (c *LinkCard) FailCount() int       { return c.failCount }
func (c *LinkCard) CreatedAt() time.Time { return c.timestamps.CreatedAt }
func (c *LinkCard) UpdatedAt() time.Time { return c.timestamps.UpdatedAt }

// String 供日志与错误信息使用的简要标识。
func (c *LinkCard) String() string {
	return fmt.Sprintf("LinkCard(%s)", c.url)
}

func truncate(s string, max int) string {
	s = strings.TrimSpace(s)
	if len(s) <= max {
		return s
	}
	return s[:max]
}
