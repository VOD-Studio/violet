// Package app 提供 auth/user DDD 模块的手工 DI 装配。
//
// auth 模块依赖图复杂（SessionStore 需 Redis client、
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
	appsettings "blog-api/internal/application/settings"
	"blog-api/internal/domain/user"
	infraauth "blog-api/internal/infrastructure/auth"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	authhttp "blog-api/internal/interfaces/http/handler/auth"
)

// AuthContainer auth/user 模块依赖容器
type AuthContainer struct {
	AuthHandler      *authhttp.Handler
	EnsureSuperAdmin *authcmd.EnsureSuperAdminHandler
	// SessionStore 同时实现 appshared.SessionStore 与 middleware.SessionLookup，
	// 由 main.go 挂载 SessionAuth/OptionalSessionAuth/SessionAuthReadOnly 中间件时使用。
	SessionStore *infraauth.RedisSessionStore
}

// NewAuthContainer 手工装配 auth DDD 模块
func NewAuthContainer(
	db *gorm.DB,
	redisClient *redis.Client,
	cfg *config.Config,
	emailSender authcmd.EmailSender,
	bus appshared.EventBus,
	settingsSvc *appsettings.Service,
) (*AuthContainer, error) {
	userRepo := gormrepo.NewUserRepository(db)
	roleRepo := gormrepo.NewRoleRepository(db)

	sessionStore := infraauth.NewRedisSessionStore(redisClient)
	codeStore := infraauth.NewRedisCodeStore(redisClient)

	hasher := authcmd.NewBcryptHasher()

	register := authcmd.NewRegisterUserHandler(userRepo, codeStore, emailSender, hasher, bus)
	login := authcmd.NewLoginHandler(userRepo, hasher)
	google := authcmd.NewGoogleLoginHandler(userRepo, cfg.GoogleClientID, hasher)
	github := authcmd.NewGithubLoginHandler(userRepo, cfg.GithubClientID, cfg.GithubClientSecret, hasher)
	logout := authcmd.NewLogoutHandler(sessionStore)
	createSession := authcmd.NewCreateSessionHandler(userRepo, sessionStore)
	verify := authcmd.NewVerifyEmailHandler(userRepo, codeStore)
	forgot := authcmd.NewForgotPasswordHandler(userRepo, codeStore, emailSender, hasher)
	reset := authcmd.NewResetPasswordHandler(userRepo, codeStore, hasher, sessionStore)
	updatePf := authcmd.NewUpdateProfileHandler(userRepo)
	changePwd := authcmd.NewChangePasswordHandler(userRepo, hasher, sessionStore)

	getMe := authquery.NewGetMeHandler(userRepo, roleRepo)

	ensureSuperAdmin := authcmd.NewEnsureSuperAdminHandler(userRepo, hasher)

	authHandler := authhttp.NewHandler(
		register, login, google, github, logout, createSession, verify, forgot, reset,
		updatePf, changePwd, getMe, settingsSvc, cfg.Cookie, cfg.Session,
	)

	return &AuthContainer{AuthHandler: authHandler, EnsureSuperAdmin: ensureSuperAdmin, SessionStore: sessionStore}, nil
}

var _ user.UserRepository = (*gormrepo.UserRepository)(nil)
