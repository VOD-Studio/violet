// Package github 提供 GitHub 数据的应用用例。
package github

import (
	"context"

	domaingithub "blog-api/internal/domain/github"
	domainsettings "blog-api/internal/domain/settings"
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
