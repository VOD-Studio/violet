package app

import (
	"context"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"

	"blog-api/config"
	appchat "blog-api/internal/application/chat"
	appcustomemoji "blog-api/internal/application/customemoji"
	appshared "blog-api/internal/application/shared"
	domainshared "blog-api/internal/domain/shared"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	infrapush "blog-api/internal/infrastructure/webpush"
	chathttp "blog-api/internal/interfaces/http/handler/chat"
)

// ChatContainer 聚合聊天服务、HTTP handler 与 SSE handler。
type ChatContainer struct {
	ChatService   *appchat.Service
	ChatHandler   *chathttp.Handler
	StreamHandler *chathttp.StreamHandler
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
	return &ChatContainer{ChatService: svc, ChatHandler: chathttp.NewHandler(svc), StreamHandler: chathttp.NewStreamHandler(manager, svc)}
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
