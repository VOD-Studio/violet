// Package repositoryactivity 定义独立于手写手记的仓库进展。
package repositoryactivity

import (
	"time"

	"blog-api/internal/domain/shared"
)

// Location 是手记日和周的站点日历时区，周一为每周首日。
var Location = shanghai()

func shanghai() *time.Location {
	zone, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		return time.FixedZone("Asia/Shanghai", 8*60*60)
	}
	return zone
}

// Cursor 按站点日历日、项目 UUID 降序分页。
type Cursor struct {
	// Day 为 Asia/Shanghai 日历日期（YYYY-MM-DD）。
	Day string
	// ProjectID 区分同日内的项目；零 UUID 排除整天。
	ProjectID shared.ID
}

// Project 是站点当前公开项目，不是 GitHub 仓库身份。
type Project struct {
	// ID 公开项目的 UUID。
	ID string `json:"id"`
	// Title 项目当前的展示标题。
	Title string `json:"title"`
	// Slug 项目公开路径标识。
	Slug string `json:"slug"`
}

// Commit 只包含提交首行，不含正文或作者数据。
type Commit struct {
	// SHA 仓库内唯一的提交哈希。
	SHA string `json:"sha"`
	// Title 提交信息的首行。
	Title string `json:"title"`
	// URL GitHub 提交详情入口。
	URL string `json:"url"`
	// OccurredAt 取 committer date，不取 author date。
	OccurredAt time.Time `json:"occurred_at"`
}

// Release 只包含已发布版本的公开元数据。
type Release struct {
	// Tag 关联的 Git 标签。
	Tag string `json:"tag"`
	// Title 优先用发布名称；名称只是标签时取首条变更，无变更时保留标签。
	Title string `json:"title"`
	// URL GitHub 版本详情入口。
	URL string `json:"url"`
	// OccurredAt 实际发布时间，不取创建时间。
	OccurredAt time.Time `json:"occurred_at"`
}

// Day 汇总一个公开项目在站点日历日中的活动。
type Day struct {
	// Day 为 Asia/Shanghai 日历日期（YYYY-MM-DD）。
	Day string `json:"day"`
	// Project 当前仍指向来源仓库的项目。
	Project Project `json:"project"`
	// FirstAt 当天两个来源的最早活动时间。
	FirstAt time.Time `json:"first_at"`
	// LastAt 当天两个来源的最晚活动时间。
	LastAt time.Time `json:"last_at"`
	// CommitCount 包含预览未展示的提交。
	CommitCount int `json:"commit_count"`
	// ReleaseCount 当天已发布版本的数量。
	ReleaseCount int `json:"release_count"`
	// Summary 取最近活动的标题，不生成额外文案。
	Summary string `json:"summary"`
	// Commits 列表最多六条，日详情全量。
	Commits []Commit `json:"commits"`
	// Releases 列表与详情均包含当天全部已同步发布。
	Releases []Release `json:"releases"`
}

const (
	StateUnconfigured = "unconfigured"
	StateSyncing      = "syncing"
	StateReady        = "ready"
	StateStale        = "stale"
	StateLimited      = "limited"
	StateFailed       = "failed"
	ReasonLimited     = "limited"
	ReasonFailed      = "failed"
)

// Health 报告当前筛选范围内最差的仓库来源状态。
type Health struct {
	// State 区分未配置、同步中、新鲜数据、陈旧缓存和不可用。
	State string `json:"state"`
	// Reason 因限流或失败时有值。
	Reason *string `json:"reason"`
	// LastSyncedAt 当前范围内最近一次成功刷新时间。
	LastSyncedAt *time.Time `json:"last_synced_at"`
}

var ErrNotFound = shared.NotFound("仓库进展")
