package app

import (
	"context"
	"io"

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
	RuntimeLog      *RuntimeLogContainer
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

// cleanup 在 HTTP 停止接收请求后调用，运行日志会在连接池关闭前排空。
func NewContainer(ctx context.Context, infra *Infra, cfg *config.Config, logOutput io.Writer) (*Container, func(), error) {
	db := infra.Gorm
	rdb := infra.Redis
	runtimeLog, logCleanup := NewRuntimeLogContainer(infra, cfg, logOutput)

	// 事件总线：进程内 InMemory 同步实现，全部模块共享单一实例，
	// 保证跨模块事件（role 创建 → 审计订阅者）在同一总线上可达。
	bus := infraeventbus.NewInMemory()

	// 审计订阅者：消费全部领域事件 → 写 audit_events（append-only）
	auditSub := appaudit.NewSubscriber(gormrepo.NewEventStore(db), log.Logger)
	auditSub.Subscribe(bus)

	role, roleCleanup, err := InitializeRoleContainer(db, bus)
	if err != nil {
		logCleanup()
		return nil, nil, err
	}
	cleanup := func() {
		roleCleanup()
		logCleanup()
	}

	emailSender := infraemail.NewSender(cfg.ResendAPIKey, cfg.EmailFrom, cfg.Environment != "production")
	permissionChecker := role.PermissionChecker

	// OAuth 凭据运行时存储：初始值来自 env；auth（登录链路）与 settings
	// （公开 client_id 下发）共享同一实例，后台写入即刻全局生效。
	oauthCreds := authcmd.NewOAuthCredentials(cfg.GoogleClientID, cfg.GithubClientID, cfg.GithubClientSecret)

	settings, err := NewSettingsContainer(ctx, infra, cfg, bus, oauthCreds)
	if err != nil {
		cleanup()
		return nil, nil, err
	}
	siteIdentity := NewSiteIdentityContainer(settings.Store)
	siteImpression := NewSiteImpressionContainer(db, rdb, []byte(cfg.ResourceSigningKey), cfg.Cookie)
	customEmoji := NewCustomEmojiContainer(db, permissionChecker, settings.Service, cfg.UploadPathPrefix)

	auth, err := NewAuthContainer(db, rdb, cfg, emailSender, bus, settings.Service, oauthCreds)
	if err != nil {
		cleanup()
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
	publication := NewPublicationContainer(db, []byte(cfg.ResourceSigningKey))
	persona := NewPersonaContainer(db)
	mcp := NewMCPContainer(apiToken.TokenLookup, post.PostService, tag.TagService, subscription.SubscriptionService, comment.CommentService, series.SeriesService, note.Service)
	codeRunner := NewCodeRunnerContainer(rdb, settings.Store, cfg.CodeRunner)
	image := NewImageContainer(cfg.UploadDir, cfg.UploadPathPrefix)
	tweet := NewTweetContainer(db, permissionChecker, customEmoji.Service, bus)
	chat := NewChatContainer(db, cfg, customEmoji.Service, bus)

	c := &Container{
		Role: role, Settings: settings, SiteIdentity: siteIdentity, SiteImpression: siteImpression, Auth: auth, Content: content, Comment: comment,
		Post: post, Tag: tag, GitHub: github, Releases: releases, Audit: audit,
		RuntimeLog: runtimeLog,
		Stats:      stats, UserAdmin: userAdmin, CommentReaction: commentReaction,
		APIToken: apiToken, Subscription: subscription, MCP: mcp, System: system,
		Media: media, CodeRunner: codeRunner, Image: image, Tweet: tweet, FriendLink: friendLink,
		Series: series, Gallery: gallery, Note: note, Publication: publication, Persona: persona, Notification: notification, Chat: chat, CustomEmoji: customEmoji,
	}
	return c, cleanup, nil
}
