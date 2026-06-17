package app

import (
	appgithub "blog-api/internal/application/github"
	domainsettings "blog-api/internal/domain/settings"
	infragithub "blog-api/internal/infrastructure/github"
	githubhttp "blog-api/internal/interfaces/http/handler/github"
)

// GitHubContainer GitHub 数据模块容器
type GitHubContainer struct {
	GitHubHandler *githubhttp.Handler
}

// NewGitHubContainer 装配 GitHub 模块（依赖 SettingsStore 读取 token）
func NewGitHubContainer(settingsStore domainsettings.SettingsStore) *GitHubContainer {
	provider := infragithub.NewAdapter()
	svc := appgithub.NewService(provider, settingsStore)
	return &GitHubContainer{GitHubHandler: githubhttp.NewHandler(svc)}
}
