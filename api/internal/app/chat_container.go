package app

import (
	"context"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"

	"blog-api/config"
	appchat "blog-api/internal/application/chat"
	appappearance "blog-api/internal/application/chatappearance"
	appcustomemoji "blog-api/internal/application/customemoji"
	appshared "blog-api/internal/application/shared"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/crypto"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	appearancegorm "blog-api/internal/infrastructure/persistence/gorm/chatappearance"
	infrapush "blog-api/internal/infrastructure/webpush"
	chathttp "blog-api/internal/interfaces/http/handler/chat"
)

// ChatContainer 聚合聊天服务、HTTP handler、SSE handler 与 bot 接入面。
type ChatContainer struct {
	ChatService     *appchat.Service
	ChatHandler     *chathttp.Handler
	StreamHandler   *chathttp.StreamHandler
	BotService      *appchat.BotService
	BotHandler      *chathttp.BotHandler
	BotAdminHandler *chathttp.BotAdminHandler
}

// NewChatContainer 装配聊天领域、持久化与浏览器推送。
// customEmojiSvc 解析消息正文中的 [name:uuid] 自定义表情占位符。
func NewChatContainer(db *gorm.DB, cfg *config.Config, customEmojiSvc *appcustomemoji.Service, bus appshared.EventBus) *ChatContainer {
	repo := gormrepo.NewChatRepository(db)
	reactionStore := gormrepo.NewChatMessageReactionStore(db)
	userRepo := gormrepo.NewUserRepository(db)
	fileRepo := gormrepo.NewFileRepository(db)
	tweetRepo := gormrepo.NewTweetRepository(db)
	manager := appchat.NewConnectionManager(log.Logger)
	var pushSender appchat.PushSender = appchat.NoopPushSender{}
	if cfg.WebPush.VAPIDPublicKey != "" && cfg.WebPush.VAPIDPrivateKey != "" && cfg.WebPush.VAPIDSubject != "" {
		pushSender = infrapush.NewSender(cfg.WebPush.VAPIDPublicKey, cfg.WebPush.VAPIDPrivateKey, cfg.WebPush.VAPIDSubject)
	}
	svc := appchat.NewService(repo, userRepo, fileRepo, manager, pushSender, cfg.WebPush.VAPIDPublicKey, nil, bus, reactionStore, tweetRepo, &chatCustomEmojiResolver{svc: customEmojiSvc})
	appearanceStore := appearancegorm.NewChatAppearanceStore(db)

	botTokenBox := newBotTokenBox(cfg)
	botRepo := gormrepo.NewBotRepository(db, botTokenBox)
	botConnections := appchat.NewBotConnectionManager(log.Logger)
	svc.WithBotNotifier(appchat.NewBotEventDispatcher(repo, botRepo, botConnections, log.Logger))
	botService := appchat.NewBotService(botRepo, userRepo, fileRepo, bus, nil)

	return &ChatContainer{
		ChatService:     svc,
		ChatHandler:     chathttp.NewHandler(svc).WithAppearanceService(appappearance.NewService(appearanceStore, appearanceStore)),
		StreamHandler:   chathttp.NewStreamHandler(manager, svc),
		BotService:      botService,
		BotHandler:      chathttp.NewBotHandler(svc, botService, botConnections),
		BotAdminHandler: chathttp.NewBotAdminHandler(botService),
	}
}

// chatCustomEmojiResolver 将 customemoji.Service 适配为 chat.CustomEmojiResolver
// 端口：把共享 resolver 的 CustomEmojiRef 转成 chat 域自有的 CustomEmojiRefDTO
// 形态（不复用其它域的 DTO 类型，保持域边界；聊天不需要 OwnerID 字段）。
type chatCustomEmojiResolver struct {
	svc *appcustomemoji.Service
}

func (a *chatCustomEmojiResolver) ResolveByIDs(ctx context.Context, ids []domainshared.ID, viewerID domainshared.ID) (map[domainshared.ID]appchat.CustomEmojiRefDTO, error) {
	refs, err := a.svc.ResolveByIDs(ctx, ids, viewerID)
	if err != nil {
		return nil, err
	}
	result := make(map[domainshared.ID]appchat.CustomEmojiRefDTO, len(refs))
	for id, ref := range refs {
		result[id] = appchat.CustomEmojiRefDTO{
			URL:           ref.URL,
			CustomEmojiID: id.String(),
			Relation:      string(ref.Relation),
		}
	}
	return result, nil
}

func (a *chatCustomEmojiResolver) ValidateContent(ctx context.Context, content string, viewerID domainshared.ID) error {
	return a.svc.ValidateContent(ctx, content, viewerID)
}

// newBotTokenBox 按配置装配 bot 凭据加解密件。
//
// 返回 nil 是合法降级（未配 BOT_TOKEN_KEY）：bot 仍能注册与鉴权，只是明文
// 不入库，后台只能靠创建/重置那一次响应拿到 token。配置缺失不阻断启动：
// 聊天以外的功能不该被一个选性密钥拖下。
func newBotTokenBox(cfg *config.Config) *crypto.TokenBox {
	if cfg.BotTokenKey == "" {
		log.Warn().Msg("BOT_TOKEN_KEY 未配置：bot token 仅创建/重置时可见一次，无法事后查看")
		return nil
	}
	box, err := crypto.NewTokenBoxFromSecret(cfg.BotTokenKey)
	if err != nil {
		log.Error().Err(err).Msg("BOT_TOKEN_KEY 无法初始化凭据加解密件，bot token 将不可回看")
		return nil
	}
	return box
}
