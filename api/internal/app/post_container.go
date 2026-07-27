package app

import (
	"gorm.io/gorm"

	apppost "blog-api/internal/application/post"
	domainsettings "blog-api/internal/domain/settings"
	"blog-api/internal/middleware"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	posthttp "blog-api/internal/interfaces/http/handler/post"
)

// PostContainer 文章模块容器
type PostContainer struct {
	PostHandler  *posthttp.Handler
	PostService  *apppost.Service // 供 MCP 模块复用（tool handler 委托文章写操作）
}

// NewPostContainer 装配文章模块。
// settingsStore 用于 import-url 的「AI 还原公式」功能读取 llm_* 配置。
func NewPostContainer(db *gorm.DB, perm middleware.PermissionChecker, settingsStore domainsettings.SettingsStore) *PostContainer {
	repo := gormrepo.NewPostRepository(db)
	userRepo := gormrepo.NewUserRepository(db)
	svc := apppost.NewService(repo, userRepo, perm, settingsStore)
	return &PostContainer{PostHandler: posthttp.NewHandler(svc), PostService: svc}
}
