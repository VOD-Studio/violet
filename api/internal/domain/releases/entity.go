// Package releases 提供更新日志（GitHub Releases）的领域模型与端口。
//
// 数据源是 GitHub Releases（release-please 发版的副产物），经 application 层
// 代理拉取 + Redis 缓存。本包定义读模型与 Provider 端口。
package releases

import (
	"context"

	domainshared "blog-api/internal/domain/shared"
)

// Release 单个版本发布
type Release struct {
	TagName     string     `json:"tag"`          // 版本号（如 v2.0.4）
	Name        string     `json:"name"`         // 发布标题
	PublishedAt string     `json:"published_at"` // ISO8601 时间
	Body        string     `json:"body"`         // release notes 原始 Markdown
	Categories  []Category `json:"categories"`   // 解析 body 得到的分类条目
	Breaking    bool       `json:"breaking"`     // 是否含 breaking change
	HTMLURL     string     `json:"html_url"`     // GitHub Release 页链接
}

// Category 单个分类（如"新功能"、"Bug 修复"），由 release body 的 section 标题解析。
// release notes 切换为 GitHub 原生生成（无 emoji）后，Label 直接取 section 标题纯文字。
type Category struct {
	Label string   `json:"label"` // 分类标题（如"新功能"、"Bug 修复"）
	Items []string `json:"items"` // 该分类下的条目
}

// ReleasesData 更新日志聚合（含当前版本）
type ReleasesData struct {
	CurrentVersion string    `json:"current_version"` // 最新版本号
	Releases       []Release `json:"releases"`        // 全部发布版本（按时间倒序）
}

// Provider GitHub Releases 数据提供者端口（infrastructure 层实现）
type Provider interface {
	// ListReleases 拉取某仓库的 releases 列表（owner/repo + token）
	ListReleases(ctx context.Context, owner, repo, token string) ([]Release, error)
}

// ErrReleasesAPI GitHub Releases 请求失败
var ErrReleasesAPI = domainshared.Internal("GitHub Releases 请求失败", nil)
