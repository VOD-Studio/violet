package app

import (
	"context"
	"strings"

	"blog-api/config"
	authcmd "blog-api/internal/application/auth/command"
	appsettings "blog-api/internal/application/settings"
	appshared "blog-api/internal/application/shared"
	domainsettings "blog-api/internal/domain/settings"
	infraauth "blog-api/internal/infrastructure/auth"
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
	opsGrants := infraauth.NewRedisOpsGrantStore(infra.Redis)
	svc := appsettings.NewService(store, bus, deploymentSettings(cfg))
	// 部署底线：生产或 COOKIE_SECURE=true 时数据库不可关闭 Secure；
	// 生产禁止非 HTTPS/localhost 可信来源。安全组生效值热刷进运行时消费者。
	svc.SetSecurityFloor(appsettings.SecurityFloor{
		CookieSecureForced: cfg.Environment == "production" || cfg.Cookie.Secure,
		Production:         cfg.Environment == "production",
	})
	svc.SetSecurityApplier(NewSecurityApplier(cfg.TrustedProxies))
	// 部署恢复模式：SECURITY_OVERRIDE_MODE=deployment 时忽略数据库安全覆盖。
	svc.SetSecurityDeploymentOnly(cfg.SecurityOverrideMode == "deployment")
	if err := svc.Initialize(ctx); err != nil {
		return nil, err
	}
	return &SettingsContainer{
		SettingsHandler: settingshttp.NewHandler(svc, oauthCreds, startupSettings{cfg: cfg, db: infra.DB}, opsGrants),
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
		// 安全组部署默认：可信代理沿用部署 TRUSTED_PROXIES；Cookie 属性沿用
		// 部署 COOKIE_*；未显式覆盖前保持部署行为，数据库覆盖需经确认生效。
		TrustedProxies:        strings.Join(cfg.TrustedProxies, ","),
		CookieSecure:          cfg.Cookie.Secure,
		CookieSameSite:        cfg.Cookie.SameSite,
		SessionMaxDevices:     0,
		CustomEmojiMaxPerUser: cfg.CustomEmojiMaxPerUser,
		CodeRunnerEnabled:     runner.Enabled, CodeRunnerMaxCPUCores: runner.MaxCPUCores,
		CodeRunnerMaxMemoryMB: runner.MaxMemoryMB, CodeRunnerMaxTimeoutSecs: runner.MaxTimeoutSecs,
		CodeRunnerMaxOutputBytes: runner.MaxOutputBytes, CodeRunnerMaxSourceBytes: runner.MaxSourceBytes,
		CodeRunnerAllowNetwork: runner.AllowNetwork, CodeRunnerLanguages: strings.Join(runner.Languages, ","),
	}
}
