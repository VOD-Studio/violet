package app

import (
	"context"
	"strings"

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
}

func NewSettingsContainer(ctx context.Context, infra *Infra, cfg *config.Config, bus appshared.EventBus, oauthCreds *authcmd.OAuthCredentials) (*SettingsContainer, error) {
	store := gormrepo.NewSettingsStore(infra.Gorm)
	svc := appsettings.NewService(store, bus, deploymentSettings(cfg))
	if err := svc.Initialize(ctx); err != nil {
		return nil, err
	}
	return &SettingsContainer{
		SettingsHandler: settingshttp.NewHandler(svc, oauthCreds, startupSettings{cfg: cfg, db: infra.DB}),
		Service:         svc, Store: svc.RuntimeReader(),
	}, nil
}

func deploymentSettings(cfg *config.Config) domainsettings.SiteSettings {
	runner := cfg.CodeRunner
	return domainsettings.SiteSettings{
		SiteName: "Violet", SiteURL: "http://localhost:3000", PostsPerPage: 10,
		FooterText:      "© 2026 Violet. All rights reserved.",
		CommentsEnabled: true, CommentsModeration: true,
		HomeFootprintEnabled: true, HomeFootprintAggregationDays: domainsettings.DefaultHomeFootprintAggregationDays,
		GoogleLoginEnabled: true, GithubLoginEnabled: true,
		CustomEmojiMaxPerUser: cfg.CustomEmojiMaxPerUser,
		CodeRunnerEnabled:     runner.Enabled, CodeRunnerMaxCPUCores: runner.MaxCPUCores,
		CodeRunnerMaxMemoryMB: runner.MaxMemoryMB, CodeRunnerMaxTimeoutSecs: runner.MaxTimeoutSecs,
		CodeRunnerMaxOutputBytes: runner.MaxOutputBytes, CodeRunnerMaxSourceBytes: runner.MaxSourceBytes,
		CodeRunnerAllowNetwork: runner.AllowNetwork, CodeRunnerLanguages: strings.Join(runner.Languages, ","),
	}
}
