package app

import (
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	appfriendlink "blog-api/internal/application/friendlink"
	appshared "blog-api/internal/application/shared"
	infraauth "blog-api/internal/infrastructure/auth"
	infraemail "blog-api/internal/infrastructure/email"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	friendlinkhttp "blog-api/internal/interfaces/http/handler/friendlink"
)

type FriendLinkContainer struct {
	FriendLinkHandler *friendlinkhttp.Handler
	FriendLinkService *appfriendlink.Service
}

// NewFriendLinkContainer 装配友链模块。
//
// redisClient 用于匿名友链申请邮箱验证码存储（与 comment 域同 Redis 不同前缀）；
// emailSender 用于匿名友链申请邮箱验证码两步流（PRD-0014）；
// userRepo 用于登录态从 user 资料覆盖 contact_email（防伪造）；
// bus 发布 friendlink.* 事件（审计订阅者消费）。
func NewFriendLinkContainer(db *gorm.DB, redisClient *redis.Client, emailSender *infraemail.Sender, bus appshared.EventBus) *FriendLinkContainer {
	friendLinkRepo := gormrepo.NewFriendLinkRepository(db)
	userRepo := gormrepo.NewUserRepository(db)
	codeStore := infraauth.NewRedisCodeStore(redisClient)
	svc := appfriendlink.NewService(friendLinkRepo, codeStore, emailSender, bus)
	return &FriendLinkContainer{
		FriendLinkHandler: friendlinkhttp.NewHandler(svc, userRepo),
		FriendLinkService: svc,
	}
}
