package app

import (
	"context"

	"gorm.io/gorm"

	appcustomemoji "blog-api/internal/application/customemoji"
	appsettings "blog-api/internal/application/settings"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	customemojihttp "blog-api/internal/interfaces/http/handler/customemoji"
)

// CustomEmojiContainer 自定义表情模块容器
type CustomEmojiContainer struct {
	Handler *customemojihttp.Handler
	Service *appcustomemoji.Service
}

// NewCustomEmojiContainer 装配自定义表情 DDD 模块。
func NewCustomEmojiContainer(
	db *gorm.DB,
	perm appcustomemoji.PermissionChecker,
	settingsSvc *appsettings.Service,
	envDefault int,
	emojiURLPrefix string,
) *CustomEmojiContainer {
	repo := gormrepo.NewCustomEmojiRepository(db)
	quota := &customEmojiQuotaPolicy{settingsSvc: settingsSvc, envDefault: envDefault}
	svc := appcustomemoji.NewService(repo, quota, perm, emojiURLPrefix)
	return &CustomEmojiContainer{
		Handler: customemojihttp.NewHandler(svc),
		Service: svc,
	}
}

// customEmojiQuotaPolicy 将 settings 模块适配为 customemoji.QuotaPolicy 端口。
//
// site_settings.custom_emoji_max_per_user 为 0（未配置）时 fallback envDefault
// （CUSTOM_EMOJI_MAX_PER_USER，默认 100），读取时机与 CodeRunnerMaxCPUCores 消费方同构。
type customEmojiQuotaPolicy struct {
	settingsSvc *appsettings.Service
	envDefault  int
}

func (a *customEmojiQuotaPolicy) MaxPerUser(ctx context.Context) (int, error) {
	s, err := a.settingsSvc.GetAll(ctx)
	if err != nil {
		return 0, err
	}
	if s.CustomEmojiMaxPerUser > 0 {
		return s.CustomEmojiMaxPerUser, nil
	}
	if a.envDefault > 0 {
		return a.envDefault, nil
	}
	return 100, nil
}
