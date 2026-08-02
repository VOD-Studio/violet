package app

import (
	"context"

	"blog-api/config"
	authcmd "blog-api/internal/application/auth/command"
	authquery "blog-api/internal/application/auth/query"
	appsettings "blog-api/internal/application/settings"
	appshared "blog-api/internal/application/shared"
	"blog-api/internal/domain/user"
	infraauth "blog-api/internal/infrastructure/auth"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	authhttp "blog-api/internal/interfaces/http/handler/auth"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type AuthContainer struct {
	AuthHandler      *authhttp.Handler
	ensureSuperAdmin *authcmd.EnsureSuperAdminHandler
	// SessionStore 同时实现 appshared.SessionStore 与 middleware.SessionLookup，
	// 由 main.go 挂载 SessionAuth/OptionalSessionAuth/SessionAuthReadOnly 中间件时使用。
	SessionStore *infraauth.RedisSessionStore
}

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

	return &AuthContainer{AuthHandler: authHandler, ensureSuperAdmin: ensureSuperAdmin, SessionStore: sessionStore}, nil
}

func (c *AuthContainer) SeedSuperAdmin(ctx context.Context, sa config.SuperAdminConfig) error {
	return c.ensureSuperAdmin.Handle(ctx, authcmd.EnsureSuperAdminInput{
		Email:    sa.Email,
		Username: sa.Username,
		Password: sa.Password,
	})
}

var _ user.UserRepository = (*gormrepo.UserRepository)(nil)
