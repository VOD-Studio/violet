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
	SiteIdentity    *SiteIdentityContainer
	SiteImpression  *SiteImpressionContainer
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
	Publication     *PublicationContainer
	Persona         *PersonaContainer
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

	// OAuth 凭据运行时存储：env 为初值，DB 单行表为后台保存的持久层
	// （auth 登录链路与 settings 公开 client_id 下发共享同一实例）。
	// Bootstrap 失败不阻断启动：登录仍可用 env 凭据，后台保存会显式失败。
	oauthCreds := authcmd.NewOAuthCredentials(
		cfg.GoogleClientID, cfg.GithubClientID, cfg.GithubClientSecret,
		gormrepo.NewOAuthCredentialsStore(db),
	)
	if err := oauthCreds.Bootstrap(ctx); err != nil {
		log.Logger.Warn().Err(err).Msg("OAuth 凭据 DB 载入失败，沿用 env 初值")
	}

	settings := NewSettingsContainer(db, bus, oauthCreds)
	siteIdentity := NewSiteIdentityContainer(settings.Store)
	siteImpression := NewSiteImpressionContainer(db, rdb, []byte(cfg.ResourceSigningKey), cfg.Cookie)
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
	notification := NewNotificationContainer(db, cfg, bus)
	system, err := NewSystemContainer(infra.DB, db, rdb, settings.Store, cfg, ctx)
	if err != nil {
		roleCleanup()
		return nil, nil, err
	}
	media := NewMediaContainer(db, rdb, cfg)
	series := NewSeriesContainer(db, bus, settings.Store, media.UploadService)
	gallery := NewGalleryContainer(db, bus, permissionChecker)
	note := NewNoteContainer(db)
	publication := NewPublicationContainer(db, []byte(cfg.ResourceSigningKey))
	persona := NewPersonaContainer(db)
	mcp := NewMCPContainer(apiToken.TokenLookup, post.PostService, tag.TagService, subscription.SubscriptionService, comment.CommentService, series.SeriesService, note.Service)
	codeRunner := NewCodeRunnerContainer(rdb, settings.Store, cfg.CodeRunner)
	image := NewImageContainer(cfg.UploadDir, cfg.UploadPathPrefix)
	tweet := NewTweetContainer(db, rdb, cfg, permissionChecker, customEmoji.Service, bus)
	chat := NewChatContainer(db, cfg, customEmoji.Service, media.UploadService, bus)
	chat.ChatService.WithTweetReader(tweet.TweetService)

	c := &Container{
		Role: role, Settings: settings, SiteIdentity: siteIdentity, SiteImpression: siteImpression, Auth: auth, Content: content, Comment: comment,
		Post: post, Tag: tag, GitHub: github, Releases: releases, Audit: audit,
		Stats: stats, UserAdmin: userAdmin, CommentReaction: commentReaction,
		APIToken: apiToken, Subscription: subscription, MCP: mcp, System: system,
		Media: media, CodeRunner: codeRunner, Image: image, Tweet: tweet, FriendLink: friendLink,
		Series: series, Gallery: gallery, Note: note, Publication: publication, Persona: persona, Notification: notification, Chat: chat, CustomEmoji: customEmoji,
	}
	return c, roleCleanup, nil
}
