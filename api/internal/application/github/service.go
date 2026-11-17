// Package github 提供 GitHub 数据的应用用例。
package github

import (
	"context"
	"regexp"

	domaingithub "blog-api/internal/domain/github"
	domainsettings "blog-api/internal/domain/settings"
	"blog-api/internal/domain/shared"
)

// Service GitHub 数据用例服务
type Service struct {
	provider domaingithub.GitHubProvider
	settings domainsettings.SettingsStore
}

// NewService 构造 GitHub 服务
func NewService(provider domaingithub.GitHubProvider, settings domainsettings.SettingsStore) *Service {
	return &Service{provider: provider, settings: settings}
}

// GetContributions 获取贡献数据（从配置读取 username/token）
func (s *Service) GetContributions(ctx context.Context) (*domaingithub.ContributionData, error) {
	m, err := s.settings.GetAll(ctx)
	if err != nil {
		return nil, err
	}
	username := m["github_username"]
	token := m["github_token"]
	if username == "" {
		return &domaingithub.ContributionData{}, nil
	}
	return s.provider.GetContributions(ctx, username, token)
}

// GetRepos 获取仓库数据（从配置读取 username/token）
func (s *Service) GetRepos(ctx context.Context) ([]domaingithub.RepoData, error) {
	m, err := s.settings.GetAll(ctx)
	if err != nil {
		return nil, err
	}
	username := m["github_username"]
	token := m["github_token"]
	if username == "" {
		return []domaingithub.RepoData{}, nil
	}
	return s.provider.GetRepos(ctx, username, token)
}

var repoOwnerPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9-]{0,38}$`)
var repoNamePattern = regexp.MustCompile(`^[A-Za-z0-9_.-]{1,100}$`)

// GetRepo 仅接受 GitHub 仓库标识，不能指定上游主机或路径。
func (s *Service) GetRepo(ctx context.Context, owner, repo string) (*domaingithub.RepoData, error) {
	if !repoOwnerPattern.MatchString(owner) || !repoNamePattern.MatchString(repo) || repo == "." || repo == ".." {
		return nil, shared.BadRequest("无效的 GitHub 仓库")
	}
	settings, err := s.settings.GetAll(ctx)
	if err != nil {
		return nil, err
	}
	return s.provider.GetRepo(ctx, owner, repo, settings["github_token"])
}
