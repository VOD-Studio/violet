// Package github 提供 GitHub 数据的领域模型与端口。
package github

import (
	"context"

	"blog-api/internal/domain/shared"
)

// ContributionData GitHub 贡献数据
type ContributionData struct {
	Username           string         `json:"username"`
	TotalContributions int            `json:"total_contributions"`
	Contributions      []Contribution `json:"contributions"`
}

// Contribution 单日贡献
type Contribution struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

// RepoData 仓库数据
type RepoData struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	URL         string `json:"url"`
	Language    string `json:"language"`
	Stars       int    `json:"stars"`
	Forks       int    `json:"forks"`
	Pinned      bool   `json:"pinned"`
}

// GitHubProvider GitHub 数据提供者端口（infrastructure 层实现）
type GitHubProvider interface {
	GetContributions(ctx context.Context, username, token string) (*ContributionData, error)
	GetRepos(ctx context.Context, username, token string) ([]RepoData, error)
}

var ErrGitHubAPI = shared.Internal("GitHub API 请求失败", nil)
