package app

import (
	appreleases "blog-api/internal/application/releases"
	domainsettings "blog-api/internal/domain/settings"
	infragithub "blog-api/internal/infrastructure/github"
	releaseshttp "blog-api/internal/interfaces/http/handler/releases"

	"github.com/redis/go-redis/v9"
)

// ReleasesContainer 更新日志模块容器
type ReleasesContainer struct {
	ReleasesHandler *releaseshttp.Handler
}

// NewReleasesContainer 装配更新日志模块
//
// 复用 github adapter（同时实现 releases.Provider 端口），
// 依赖 SettingsStore 读 owner/repo/token、Redis client 做缓存。
func NewReleasesContainer(settingsStore domainsettings.SettingsStore, rdb *redis.Client) *ReleasesContainer {
	provider := infragithub.NewAdapter()
	svc := appreleases.NewService(provider, settingsStore, rdb)
	return &ReleasesContainer{ReleasesHandler: releaseshttp.NewHandler(svc)}
}
