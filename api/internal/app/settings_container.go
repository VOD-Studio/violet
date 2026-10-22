package app

import (
	"gorm.io/gorm"

	"blog-api/config"
	authcmd "blog-api/internal/application/auth/command"
	appsettings "blog-api/internal/application/settings"
	appshared "blog-api/internal/application/shared"
	domainsettings "blog-api/internal/domain/settings"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	settingshttp "blog-api/internal/interfaces/http/handler/settings"
)

type SettingsContainer struct {
	SettingsHandler *settingshttp.Handler
	Service         *appsettings.Service
	Store           domainsettings.SettingsStore
	RuntimePolicies *appsettings.RuntimePolicies
	RuntimeHandler  *settingshttp.RuntimeHandler
}

// oauthCreds 由 auth 容器先构造再传入（公开 settings 需下发实时 client_id）。
func NewSettingsContainer(db *gorm.DB, bus appshared.EventBus, oauthCreds *authcmd.OAuthCredentials, cfg config.CodeRunnerConfig) *SettingsContainer {
	store := gormrepo.NewSettingsStore(db)
	svc := appsettings.NewService(store, bus)
	languages := cfg.Languages
	if len(languages) == 0 {
		languages = nil
	}
	policies := appsettings.NewRuntimePolicies(gormrepo.NewRuntimePolicyStore(db), domainsettings.CodeRunnerPolicy{
		Enabled: true, Languages: languages,
		MaxCPUCores: cfg.MaxCPUCores, MaxMemoryMB: cfg.MaxMemoryMB,
		MaxTimeoutSecs: cfg.MaxTimeoutSecs, MaxOutputBytes: cfg.MaxOutputBytes,
		MaxSourceBytes: cfg.MaxSourceBytes, AllowNetwork: cfg.AllowNetwork,
		MaxConcurrent: cfg.MaxConcurrent, QueueTimeoutSecs: cfg.QueueTimeoutSecs,
		TaskTTLSecs: cfg.TaskTTLSecs,
	}, bus)
	policies.SetCodeRunnerDefaultSources(cfg.DefaultSources)
	return &SettingsContainer{
		SettingsHandler: settingshttp.NewHandler(svc, oauthCreds),
		Service:         svc,
		Store:           store,
		RuntimePolicies: policies,
		RuntimeHandler:  settingshttp.NewRuntimeHandler(policies),
	}
}
