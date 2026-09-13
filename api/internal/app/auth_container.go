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
	oauthCreds *authcmd.OAuthCredentials,
) (*AuthContainer, error) {
	userRepo := gormrepo.NewUserRepository(db)
	roleRepo := gormrepo.NewRoleRepository(db)

	sessionStore := infraauth.NewRedisSessionStore(redisClient)
	codeStore := infraauth.NewRedisCodeStore(redisClient)
	opsGrants := infraauth.NewRedisOpsGrantStore(redisClient)

	hasher := authcmd.NewBcryptHasher()

	register := authcmd.NewRegisterUserHandler(userRepo, codeStore, emailSender, hasher, bus)
	login := authcmd.NewLoginHandler(userRepo, hasher, bus)
	google := authcmd.NewGoogleLoginHandler(userRepo, cfg.GoogleClientID, hasher, bus)
	github := authcmd.NewGithubLoginHandler(userRepo, oauthCreds, hasher, bus)
	logout := authcmd.NewLogoutHandler(sessionStore, opsGrants, bus)
	createSession := authcmd.NewCreateSessionHandler(userRepo, sessionStore, bus)
	verify := authcmd.NewVerifyEmailHandler(userRepo, codeStore, bus)
	forgot := authcmd.NewForgotPasswordHandler(userRepo, codeStore, emailSender, hasher)
	reset := authcmd.NewResetPasswordHandler(userRepo, codeStore, hasher, sessionStore, opsGrants)
	updatePf := authcmd.NewUpdateProfileHandler(userRepo)
	changePwd := authcmd.NewChangePasswordHandler(userRepo, hasher, sessionStore, opsGrants)

	listSessions := authcmd.NewListUserSessionsHandler(sessionStore)
	revokeSession := authcmd.NewRevokeUserSessionHandler(sessionStore, opsGrants, bus)
	issueGrant := authcmd.NewIssueOpsGrantHandler(userRepo, hasher, codeStore, emailSender, opsGrants, bus)
	requestGrantCode := authcmd.NewRequestOpsGrantCodeHandler(userRepo, codeStore, emailSender)
	revokeGrant := authcmd.NewRevokeOpsGrantHandler(opsGrants, bus)
	getMe := authquery.NewGetMeHandler(userRepo, roleRepo)
	ensureSuperAdmin := authcmd.NewEnsureSuperAdminHandler(userRepo, hasher)

	authHandler := authhttp.NewHandler(
		register, login, google, github, logout, createSession, verify, forgot, reset,
		updatePf, changePwd, getMe, settingsSvc, oauthCreds, cfg.Cookie, cfg.Session,
		listSessions, revokeSession, issueGrant, revokeGrant, requestGrantCode, opsGrants,
	)

	// 旧版 SET 会话索引升级为 ZSET（并发上限/设备列表依赖），幂等。
	if err := sessionStore.MigrateLegacyIndexes(context.Background(), cfg.Session.IdleTTL); err != nil {
		return nil, err
	}

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
