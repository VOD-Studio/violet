// Package app 提供 auth/user DDD 模块的手工 DI 装配。
//
// auth 模块依赖图复杂（JWTService 需密钥路径、RedisStore 需 Redis client、
// 各 command handler 需组合多个依赖），用 wire 表达成本高且易错，
// 改用手工构造函数装配，由 main.go 调用。
//
// EmailSender 适配：复用旧 service.EmailService（已实现 SendVerificationCode），
// 通过接口适配避免重写邮件模板。
package app

import (
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	"blog-api/config"
	authcmd "blog-api/internal/application/auth/command"
	authquery "blog-api/internal/application/auth/query"
	appshared "blog-api/internal/application/shared"
	"blog-api/internal/domain/user"
	infraauth "blog-api/internal/infrastructure/auth"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	authhttp "blog-api/internal/interfaces/http/handler/auth"
)

// EmailSenderAdapter 适配旧 EmailService 到 auth application 的 EmailSender 端口
//
// 旧 service.EmailService 已实现 SendVerificationCode/SendPasswordResetCode，
// 但方法签名与 auth command 的 EmailSender 接口可能略有差异。
// 若签名一致可直接传入；否则通过此适配器桥接。
type EmailSenderAdapter interface {
	SendVerificationCodeToUser(ctx any, email, code string) error
}

// AuthContainer auth/user 模块依赖容器
type AuthContainer struct {
	AuthHandler      *authhttp.Handler
	EnsureSuperAdmin *authcmd.EnsureSuperAdminHandler
	// JWTService 供 middleware.Auth 通过适配器使用（旧 *service.AuthService 删除后将成为唯一 token 校验源）
	JWTService *infraauth.JWTService
}

// NewAuthContainer 手工装配 auth DDD 模块
//
// 参数：
//   - db: GORM 连接（已配置连接池）
//   - redisClient: Redis 客户端
//   - cfg: 配置（含 JWT 密钥路径、TTL）
//   - emailSender: 邮件发送器（复用旧 EmailService）
//   - bus: 事件总线
func NewAuthContainer(
	db *gorm.DB,
	redisClient *redis.Client,
	cfg *config.Config,
	emailSender authcmd.EmailSender,
	bus appshared.EventBus,
) (*AuthContainer, error) {
	// 1. Repository
	userRepo := gormrepo.NewUserRepository(db)

	// 2. Infrastructure services
	jwtService, err := infraauth.NewJWTService(
		cfg.JWTPrivateKeyPath, cfg.JWTPublicKeyPath,
		cfg.JWTAccessTokenTTL, cfg.JWTRefreshTokenTTL,
	)
	if err != nil {
		return nil, err
	}
	tokenStore := infraauth.NewRedisTokenStore(redisClient, cfg.JWTRefreshTokenTTL)
	codeStore := infraauth.NewRedisCodeStore(redisClient)

	// 3. Password hasher
	hasher := authcmd.NewBcryptHasher()

	// 4. Application 层 command handlers
	register := authcmd.NewRegisterUserHandler(userRepo, codeStore, emailSender, hasher, bus)
	login := authcmd.NewLoginHandler(userRepo, hasher, jwtService, tokenStore)
	logout := authcmd.NewLogoutHandler(tokenStore)
	refresh := authcmd.NewRefreshTokenHandler(userRepo, jwtService, tokenStore)
	verify := authcmd.NewVerifyEmailHandler(userRepo, codeStore)
	forgot := authcmd.NewForgotPasswordHandler(userRepo, codeStore, emailSender, hasher, tokenStore)
	reset := authcmd.NewResetPasswordHandler(userRepo, codeStore, hasher, tokenStore)
	updatePf := authcmd.NewUpdateProfileHandler(userRepo)
	changePwd := authcmd.NewChangePasswordHandler(userRepo, hasher, tokenStore)

	// 5. Query handler
	getMe := authquery.NewGetMeHandler(userRepo)

	// 5b. 超级管理员初始化用例（启动期幂等执行）
	ensureSuperAdmin := authcmd.NewEnsureSuperAdminHandler(userRepo, hasher)

	// 6. HTTP handler
	authHandler := authhttp.NewHandler(
		register, login, logout, refresh, verify, forgot, reset,
		updatePf, changePwd, getMe,
	)

	return &AuthContainer{AuthHandler: authHandler, EnsureSuperAdmin: ensureSuperAdmin, JWTService: jwtService}, nil
}

// 编译期断言：确保 userRepo 满足接口
var _ user.UserRepository = (*gormrepo.UserRepository)(nil)
