package repositoryactivity

import (
	"context"
	"errors"
	"strings"
	"time"

	"blog-api/internal/domain/shared"
)

// RepositoryKey 只接受 HTTPS 仓库首页，以不区分大小写的 owner/repo 作为同步键。
func RepositoryKey(raw string) (string, bool) {
	const base = "https://github.com/"
	if len(raw) <= len(base) || !strings.EqualFold(raw[:len(base)], base) {
		return "", false
	}
	path := strings.TrimSuffix(raw[len(base):], "/")
	owner, repo, ok := strings.Cut(path, "/")
	if !ok || len(owner) == 0 || len(owner) > 39 || len(repo) == 0 || len(repo) > 100 || repo == "." || repo == ".." {
		return "", false
	}
	if !asciiAlnum(owner[0]) {
		return "", false
	}
	for i := 1; i < len(owner); i++ {
		if !asciiAlnum(owner[i]) && owner[i] != '-' {
			return "", false
		}
	}
	for i := range len(repo) {
		c := repo[i]
		if !asciiAlnum(c) && c != '-' && c != '_' && c != '.' {
			return "", false
		}
	}
	return strings.ToLower(path), true
}

func asciiAlnum(c byte) bool {
	return 'a' <= c && c <= 'z' || 'A' <= c && c <= 'Z' || '0' <= c && c <= '9'
}

// Binding 仅在公开项目仍指向同一链接时关联仓库活动。
type Binding struct {
	// ProjectID 站点公开项目的 UUID。
	ProjectID shared.ID
	// URL 项目配置原值；读取活动时在同一 SQL 快照二次核对。
	URL string
	// Key 归一化的 GitHub owner/repo。
	Key string
}

// Remote 只表示 GitHub 明确核验过的公开仓库。
type Remote struct {
	// ID GitHub 的不可变仓库标识，不随名称变化。
	ID int64
	// Key 保留大小写的 GitHub 规范 owner/repo。
	Key string
	// DefaultBranch 只收集此分支的可达提交。
	DefaultBranch string
}

const (
	KindCommit  = "commit"
	KindRelease = "release"
)

// Event 只保留构成进展卡的公开元数据。
type Event struct {
	// Kind 区分提交与发布。
	Kind string
	// ID 提交 SHA 或发布编号，以仓库与 Kind 为去重范围。
	ID string
	// Tag 仅发布有值，不参与去重。
	Tag string
	// Title 提交首行或发布标题。
	Title string
	// URL GitHub 原始活动入口。
	URL string
	// OccurredAt 取 Git committer date 或 release published_at。
	OccurredAt time.Time
}

// Page 按 GitHub 返回顺序记录单页活动。
type Page struct {
	// Events 不含草稿或非公开活动。
	Events []Event
	// HasNext 仅记录是否有下一页，不信任服务端返回的链接地址。
	HasNext bool
}

var ErrUnavailable = errors.New("GitHub 仓库不公开或不可访问")

// RateLimitError 记录 GitHub 允许恢复匿名请求的时间。
type RateLimitError struct {
	// RetryAt 恢复请求的最早时间。
	RetryAt time.Time
}

func (e *RateLimitError) Error() string {
	return "GitHub API 限流，恢复时间：" + e.RetryAt.Format(time.RFC3339)
}

// Provider 只读 GitHub 公开数据，不接受凭据。
type Provider interface {
	Inspect(ctx context.Context, key string) (Remote, error)
	Commits(ctx context.Context, remote Remote, ref string, page int) (Page, error)
	Releases(ctx context.Context, remote Remote, page int) (Page, error)
}

// Stream 分开记录增量更新与历史对账的进度。
type Stream struct {
	// Initialized 仓库为空时也记录首批已同步。
	Initialized bool `json:"initialized"`
	// Head 上次完成的增量批次的首条活动标识。
	Head string `json:"head"`
	// PendingHead 跨页增量正在追踪的新头部标识。
	PendingHead string `json:"pending_head"`
	// NextPage 下次续查的增量页；零表示当前未续查。
	NextPage int `json:"next_page"`
	// BackfillAnchor 用不可变 SHA 固定提交历史分页。
	BackfillAnchor string `json:"backfill_anchor"`
	// BackfillPage 下次续查的对账页；零表示当前批次已结束。
	BackfillPage int `json:"backfill_page"`
	// SweepStartedAt 当前或上一对账批次的水位，已读取的活动写入同一水位。
	SweepStartedAt time.Time `json:"sweep_started_at"`
	// SweptAt 上次完整对账的完成时间。
	SweptAt time.Time `json:"swept_at"`
}

// Source 独立于事件身份，记录当前链接的核验与同步进度。
type Source struct {
	// Key 归一化的 GitHub 仓库路径。
	Key string
	// RepositoryID 最近一次核验时该路径对应的 GitHub 仓库 ID。
	RepositoryID int64
	// DefaultBranch 提交检查点归属的分支。
	DefaultBranch string
	// Unavailable 立即撤销可见性，不受缓存时效影响。
	Unavailable bool
	// AttemptedAt 优先调度久未尝试和新加入的仓库。
	AttemptedAt time.Time
	// VerifiedAt GitHub 上一次确认仓库公开的时间。
	VerifiedAt *time.Time
	// DataAt 首次成功拉取活动的时间，允许先展示部分回填结果。
	DataAt *time.Time
	// SyncedAt 上次所有尝试的页面都同步成功的时间。
	SyncedAt *time.Time
	// Reason 区分限流与其他同步失败。
	Reason string
	// RetryAt 暂停匿名请求直至限流恢复。
	RetryAt *time.Time
	// Commits 提交的增量和历史检查点。
	Commits Stream
	// Releases 发布页位可移动，按 GitHub 发布编号去重。
	Releases Stream
}

// Visible 要求仓库核验与缓存数据都尚未过期。
func (s Source) Visible(cutoff time.Time) bool {
	dataAt := s.SyncedAt
	if dataAt == nil {
		dataAt = s.DataAt
	}
	return !s.Unavailable && s.RepositoryID != 0 && s.VerifiedAt != nil && !s.VerifiedAt.Before(cutoff) &&
		dataAt != nil && !dataAt.Before(cutoff)
}

// Change 将当前事件页或对账清理与检查点一并原子写入。
type Change struct {
	// Events 当前抓取页的公开元数据。
	Events []Event
	// SeenAt 对账水位，同一批次的历史页与增量页共用。
	SeenAt time.Time
	// DropCommits 切换默认分支时丢弃旧提交，不影响发布。
	DropCommits bool
	// ReconciledKind 非空时删除此类型未在本轮对账看到的事件。
	ReconciledKind string
}

// Repository 持久化后台检查点，并为前台仅从数据库读取日卡。
type Repository interface {
	Sources(ctx context.Context, keys []string) (map[string]Source, error)
	BlockedUntil(ctx context.Context, now time.Time) (*time.Time, error)
	Save(ctx context.Context, state Source, change Change) error
	Browse(ctx context.Context, bindings []Binding, before *Cursor, limit int, cutoff time.Time) ([]Day, error)
	GetDay(ctx context.Context, binding Binding, day string, cutoff time.Time) (Day, error)
}
