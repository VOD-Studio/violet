// Package app 提供 auth/user DDD 模块的手工 DI 装配。
//
// auth 模块依赖图复杂（JWTService 需密钥路径、RedisStore 需 Redis client、
// 各 command handler 需组合多个依赖），用 wire 表达成本高且易错，
// 改用手工构造函数装配，由 main.go 调用。
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

// AuthContainer auth/user 模块依赖容器
type AuthContainer struct {
	AuthHandler      *authhttp.Handler
	EnsureSuperAdmin *authcmd.EnsureSuperAdminHandler
	JWTService       *infraauth.JWTService
}

// NewAuthContainer 手工装配 auth DDD 模块
func NewAuthContainer(
	db *gorm.DB,
	redisClient *redis.Client,
	cfg *config.Config,
	emailSender authcmd.EmailSender,
	bus appshared.EventBus,
) (*AuthContainer, error) {
	userRepo := gormrepo.NewUserRepository(db)

	jwtService, err := infraauth.NewJWTService(
		cfg.JWTPrivateKeyPath, cfg.JWTPublicKeyPath,
		cfg.JWTAccessTokenTTL, cfg.JWTRefreshTokenTTL,
	)
	if err != nil {
		return nil, err
	}
	tokenStore := infraauth.NewRedisTokenStore(redisClient, cfg.JWTRefreshTokenTTL)
	codeStore := infraauth.NewRedisCodeStore(redisClient)

	hasher := authcmd.NewBcryptHasher()

	register := authcmd.NewRegisterUserHandler(userRepo, codeStore, emailSender, hasher, bus)
	login := authcmd.NewLoginHandler(userRepo, hasher, jwtService, tokenStore)
	logout := authcmd.NewLogoutHandler(tokenStore)
	refresh := authcmd.NewRefreshTokenHandler(userRepo, jwtService, tokenStore)
	verify := authcmd.NewVerifyEmailHandler(userRepo, codeStore)
	forgot := authcmd.NewForgotPasswordHandler(userRepo, codeStore, emailSender, hasher, tokenStore)
	reset := authcmd.NewResetPasswordHandler(userRepo, codeStore, hasher, tokenStore)
	updatePf := authcmd.NewUpdateProfileHandler(userRepo)
	changePwd := authcmd.NewChangePasswordHandler(userRepo, hasher, tokenStore)

	getMe := authquery.NewGetMeHandler(userRepo)

	ensureSuperAdmin := authcmd.NewEnsureSuperAdminHandler(userRepo, hasher)

	authHandler := authhttp.NewHandler(
		register, login, logout, refresh, verify, forgot, reset,
		updatePf, changePwd, getMe,
	)

	return &AuthContainer{AuthHandler: authHandler, EnsureSuperAdmin: ensureSuperAdmin, JWTService: jwtService}, nil
}

var _ user.UserRepository = (*gormrepo.UserRepository)(nil)
