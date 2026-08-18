package app

import (
	"gorm.io/gorm"

	authcmd "blog-api/internal/application/auth/command"
	appsettings "blog-api/internal/application/settings"
	appshared "blog-api/internal/application/shared"
	domainsettings "blog-api/internal/domain/settings"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	settingshttp "blog-api/internal/interfaces/http/handler/settings"
)

// SettingsContainer 站点配置模块容器
type SettingsContainer struct {
	SettingsHandler *settingshttp.Handler
	Service         *appsettings.Service
	Store           domainsettings.SettingsStore
}

// NewSettingsContainer 装配站点配置模块。
// oauthCreds 由 auth 容器先构造再传入（公开 settings 需下发实时 client_id）。
func NewSettingsContainer(db *gorm.DB, bus appshared.EventBus, oauthCreds *authcmd.OAuthCredentials) *SettingsContainer {
	store := gormrepo.NewSettingsStore(db)
	svc := appsettings.NewService(store, bus)
	return &SettingsContainer{
		SettingsHandler: settingshttp.NewHandler(svc, oauthCreds),
		Service:         svc,
		Store:           store,
	}
}
