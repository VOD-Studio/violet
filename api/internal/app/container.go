// Package app 根容器：聚合全部 DDD 模块容器，封装跨模块依赖的装配顺序。
//
// 各模块独立 container 仍在同包下（xxx_container.go）。NewContainer 仅按
// 依赖序串联装配，集中 main 的命令式 new 调用，使 main 回归编排角色。
package app

import (
	"context"

	"github.com/rs/zerolog/log"

	"blog-api/config"
	appaudit "blog-api/internal/application/audit"
	authcmd "blog-api/internal/application/auth/command"
	infraemail "blog-api/internal/infrastructure/email"
	infraeventbus "blog-api/internal/infrastructure/eventbus"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
)

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
	Tweet           *TweetContainer
	FriendLink      *FriendLinkContainer
	Series          *SeriesContainer
	Gallery         *GalleryContainer
	Note            *NoteContainer
	Notification    *NotificationContainer
	Chat            *ChatContainer
	CustomEmoji     *CustomEmojiContainer
}

// 跨模块依赖（装配顺序即依赖序）：
//   - role 无依赖但持有 cleanup
//   - emailSender 从 cfg 派生，被 auth + comment + friendlink 复用
//   - post.PostService 被 subscription + mcp 依赖
//   - apiToken.TokenLookup + comment.CommentService 被 mcp 依赖
//
// 返回的 cleanup 仅释放 role 容器资源；infra（DB/Redis）的释放仍由 main 管理。
// ctx 用于 system 容器的后台采样 goroutine 生命周期。
func NewContainer(ctx context.Context, infra *Infra, cfg *config.Config) (*Container, func(), error) {
	db := infra.Gorm
	rdb := infra.Redis

	// 事件总线：进程内 InMemory 同步实现，全部模块共享单一实例，
	// 保证跨模块事件（role 创建 → 审计订阅者）在同一总线上可达。
	bus := infraeventbus.NewInMemory()

	// 审计订阅者：消费全部领域事件 → 写 audit_events（append-only）
	auditSub := appaudit.NewSubscriber(gormrepo.NewEventStore(db), log.Logger)
	auditSub.Subscribe(bus)

	role, roleCleanup, err := InitializeRoleContainer(db, bus)
	if err != nil {
		return nil, nil, err
	}

	emailSender := infraemail.NewSender(cfg.ResendAPIKey, cfg.EmailFrom, cfg.Environment != "production")
	permissionChecker := role.PermissionChecker

	// OAuth 凭据运行时存储：初始值来自 env；auth（登录链路）与 settings
	// （公开 client_id 下发）共享同一实例，后台写入即刻全局生效。
	oauthCreds := authcmd.NewOAuthCredentials(cfg.GoogleClientID, cfg.GithubClientID, cfg.GithubClientSecret)

	settings := NewSettingsContainer(db, bus, oauthCreds)
	customEmoji := NewCustomEmojiContainer(db, permissionChecker, settings.Service, cfg.CustomEmojiMaxPerUser, cfg.UploadPathPrefix)

	auth, err := NewAuthContainer(db, rdb, cfg, emailSender, bus, settings.Service, oauthCreds)
	if err != nil {
		roleCleanup()
		return nil, nil, err
	}

	content := NewContentContainer(db, bus)
	comment := NewCommentContainer(db, rdb, emailSender, settings.Service, customEmoji.Service, bus)
	post := NewPostContainer(db, permissionChecker, settings.Store, bus)
	tag := NewTagContainer(db)
	github := NewGitHubContainer(settings.Store)
	releases := NewReleasesContainer(settings.Store, rdb)
	audit := NewAuditContainer(db)
	stats := NewStatsContainer(db)
	userAdmin := NewUserAdminContainer(db, authcmd.NewBcryptHasher(), bus, auth.SessionStore)
	apiToken := NewAPITokenContainer(db, bus)
	subscription := NewSubscriptionContainer(db, post.PostService, bus, cfg.FeedProxyURL)
	commentReaction := NewCommentReactionContainer(db)
	friendLink := NewFriendLinkContainer(db, rdb, emailSender, bus)
	notification := NewNotificationContainer(db, bus)
	system := NewSystemContainer(db, rdb, ctx)
	media := NewMediaContainer(db, rdb, cfg)
	series := NewSeriesContainer(db, bus, settings.Store, media.UploadService)
	gallery := NewGalleryContainer(db, bus, permissionChecker)
	note := NewNoteContainer(db)
	mcp := NewMCPContainer(apiToken.TokenLookup, post.PostService, tag.TagService, subscription.SubscriptionService, comment.CommentService, series.SeriesService, note.Service)
	codeRunner := NewCodeRunnerContainer(rdb, settings.Store, cfg.CodeRunner)
	image := NewImageContainer(cfg.UploadDir, cfg.UploadPathPrefix)
	tweet := NewTweetContainer(db, permissionChecker, customEmoji.Service, bus)
	chat := NewChatContainer(db, cfg, customEmoji.Service, bus)

	c := &Container{
		Role: role, Settings: settings, Auth: auth, Content: content, Comment: comment,
		Post: post, Tag: tag, GitHub: github, Releases: releases, Audit: audit,
		Stats: stats, UserAdmin: userAdmin, CommentReaction: commentReaction,
		APIToken: apiToken, Subscription: subscription, MCP: mcp, System: system,
		Media: media, CodeRunner: codeRunner, Image: image, Tweet: tweet, FriendLink: friendLink,
		Series: series, Gallery: gallery, Note: note, Notification: notification, Chat: chat, CustomEmoji: customEmoji,
	}
	return c, roleCleanup, nil
}
