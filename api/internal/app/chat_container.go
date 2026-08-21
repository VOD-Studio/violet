package app

import (
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"

	"blog-api/config"
	appchat "blog-api/internal/application/chat"
	appshared "blog-api/internal/application/shared"
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
func NewChatContainer(db *gorm.DB, cfg *config.Config, bus appshared.EventBus) *ChatContainer {
	repo := gormrepo.NewChatRepository(db)
	reactionStore := gormrepo.NewChatMessageReactionStore(db)
	userRepo := gormrepo.NewUserRepository(db)
	fileRepo := gormrepo.NewFileRepository(db)
	manager := appchat.NewConnectionManager(log.Logger)
	var pushSender appchat.PushSender = appchat.NoopPushSender{}
	if cfg.WebPush.VAPIDPublicKey != "" && cfg.WebPush.VAPIDPrivateKey != "" && cfg.WebPush.VAPIDSubject != "" {
		pushSender = infrapush.NewSender(cfg.WebPush.VAPIDPublicKey, cfg.WebPush.VAPIDPrivateKey, cfg.WebPush.VAPIDSubject)
	}
	svc := appchat.NewService(repo, userRepo, fileRepo, manager, pushSender, cfg.WebPush.VAPIDPublicKey, nil, bus, reactionStore)
	return &ChatContainer{ChatService: svc, ChatHandler: chathttp.NewHandler(svc), StreamHandler: chathttp.NewStreamHandler(manager, svc)}
}
