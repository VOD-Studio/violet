// Package app 根容器：聚合全部 DDD 模块容器，封装跨模块依赖的装配顺序。
//
// 各模块独立 container 仍在同包下（xxx_container.go）。NewContainer 仅按
// 依赖序串联装配，集中 main 的命令式 new 调用，使 main 回归编排角色。
package app

import (
	"context"

	"blog-api/config"
	authcmd "blog-api/internal/application/auth/command"
	appshared "blog-api/internal/application/shared"
	infraemail "blog-api/internal/infrastructure/email"
)

// Container 聚合全部 DDD 模块容器，作为应用 composition root。
//
// 由 cmd/server/main.go 在完成基础设施初始化后调用 NewContainer 构造。
// 持有全部子容器便于 main/jobs/seed 等从统一入口取字段。
type Container struct {
	Role            *RoleContainer
	Settings        *SettingsContainer
	Auth            *AuthContainer
	Content         *ContentContainer
	Comment         *CommentContainer
	Post            *PostContainer
	Tag             *TagContainer
	GitHub          *GitHubContainer
	Releases        *ReleasesContainer
	Audit           *AuditContainer
	Stats           *StatsContainer
	UserAdmin       *UserAdminContainer
	CommentReaction *CommentReactionContainer
	APIToken        *APITokenContainer
	Subscription    *SubscriptionContainer
	MCP             *MCPContainer
	System          *SystemContainer
	Media           *MediaContainer
	CodeRunner      *CodeRunnerContainer
	Image           *ImageContainer
}

// NewContainer 按依赖序装配全部模块容器，封装跨模块依赖图。
//
// 依赖关系（装配顺序即依赖序）：
//   - role（无依赖，但持有 cleanup）
//   - emailSender（从 cfg 派生，被 auth + comment 复用）
//   - settings.Service 被 auth 依赖，settings.Store 被 post/github/coderunner 依赖
//   - audit.Service 被 userAdmin 依赖
//   - post.PostService 被 subscription + mcp 依赖
//   - apiToken.TokenLookup + comment.CommentService 被 mcp 依赖
//
// 返回的 cleanup 仅释放 role 容器资源；infra（DB/Redis）的释放仍由 main 管理。
// ctx 用于 system 容器的后台采样 goroutine 生命周期。
func NewContainer(ctx context.Context, infra *Infra, cfg *config.Config) (*Container, func(), error) {
	db := infra.Gorm
	rdb := infra.Redis

	role, roleCleanup, err := InitializeRoleContainer(db)
	if err != nil {
		return nil, nil, err
	}

	emailSender := infraemail.NewSender(cfg.ResendAPIKey, cfg.EmailFrom, cfg.Environment != "production")
	permissionChecker := role.PermissionChecker

	settings := NewSettingsContainer(db)

	auth, err := NewAuthContainer(db, rdb, cfg, emailSender, appshared.NoopEventBus{}, settings.Service)
	if err != nil {
		roleCleanup()
		return nil, nil, err
	}

	content := NewContentContainer(db)
	comment := NewCommentContainer(db, rdb, emailSender)
	post := NewPostContainer(db, permissionChecker, settings.Store)
	tag := NewTagContainer(db)
	github := NewGitHubContainer(settings.Store)
	releases := NewReleasesContainer(settings.Store, rdb)
	audit := NewAuditContainer(db)
	stats := NewStatsContainer(db)
	userAdmin := NewUserAdminContainer(db, authcmd.NewBcryptHasher(), audit.Service)
	commentReaction := NewCommentReactionContainer(db)
	apiToken := NewAPITokenContainer(db)
	subscription := NewSubscriptionContainer(db, post.PostService)
	mcp := NewMCPContainer(apiToken.TokenLookup, post.PostService, subscription.SubscriptionService, comment.CommentService)
	system := NewSystemContainer(db, rdb, ctx)
	media := NewMediaContainer(db, rdb, cfg)
	codeRunner := NewCodeRunnerContainer(rdb, settings.Store, cfg.CodeRunner)
	image := NewImageContainer(cfg.UploadDir, cfg.UploadPathPrefix)

	c := &Container{
		Role: role, Settings: settings, Auth: auth, Content: content, Comment: comment,
		Post: post, Tag: tag, GitHub: github, Releases: releases, Audit: audit,
		Stats: stats, UserAdmin: userAdmin, CommentReaction: commentReaction,
		APIToken: apiToken, Subscription: subscription, MCP: mcp, System: system,
		Media: media, CodeRunner: codeRunner, Image: image,
	}
	return c, roleCleanup, nil
}
