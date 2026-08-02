// Package github 提供 GitHub 数据的领域模型与端口。
package github

import (
	"context"

	"blog-api/internal/domain/shared"
)

// ContributionData GitHub 贡献数据
type ContributionData struct {
	// username 查询的 GitHub 用户名（同时也是 GetContributions 的入参）
	Username string `json:"username"`
	// totalContributions 统计时段内的总贡献数（提交/PR/issue 等计入贡献日历的活动之和）
	TotalContributions int `json:"total_contributions"`
	// contributions 按日展开的贡献明细列表
	Contributions []Contribution `json:"contributions"`
}

// Contribution 单日贡献
type Contribution struct {
	// date 日期，格式 YYYY-MM-DD
	Date string `json:"date"`
	// count 当日计入贡献日历的活动次数
	Count int `json:"count"`
}

// RepoData 仓库数据
type RepoData struct {
	// name 仓库名
	Name string `json:"name"`
	// description 仓库描述
	Description string `json:"description"`
	// url 仓库页面地址
	URL string `json:"url"`
	// language 仓库的主要编程语言
	Language string `json:"language"`
	// stars star 数
	Stars int `json:"stars"`
	// forks fork 数
	Forks int `json:"forks"`
	// pinned 是否为 GitHub 置顶仓库
	Pinned bool `json:"pinned"`
}

// GitHubProvider GitHub 数据提供者端口（infrastructure 层实现）
type GitHubProvider interface {
	GetContributions(ctx context.Context, username, token string) (*ContributionData, error)
	GetRepos(ctx context.Context, username, token string) ([]RepoData, error)
}

var ErrGitHubAPI = shared.Internal("GitHub API 请求失败", nil)
