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
	emojiURLPrefix string,
) *CustomEmojiContainer {
	repo := gormrepo.NewCustomEmojiRepository(db)
	quota := &customEmojiQuotaPolicy{settingsSvc: settingsSvc}
	svc := appcustomemoji.NewService(repo, quota, perm, emojiURLPrefix)
	return &CustomEmojiContainer{
		Handler: customemojihttp.NewHandler(svc),
		Service: svc,
	}
}

// customEmojiQuotaPolicy 将 settings 模块适配为 customemoji.QuotaPolicy 端口。
type customEmojiQuotaPolicy struct {
	settingsSvc *appsettings.Service
}

func (a *customEmojiQuotaPolicy) MaxPerUser(ctx context.Context) (int, error) {
	s, err := a.settingsSvc.GetAll(ctx)
	if err != nil {
		return 0, err
	}
	return s.CustomEmojiMaxPerUser, nil
}
