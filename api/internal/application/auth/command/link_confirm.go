package command

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/rs/zerolog/log"

	appshared "blog-api/internal/application/shared"
	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/user"
)

// linkTokenTTL 绑定确认中间态有效期：从 OAuth 第一阶段起算，超时整个流程重来。
const linkTokenTTL = 5 * time.Minute

// maxLinkPasswordAttempts 密码错误上限：达到即作废 token，防在线爆破。
const maxLinkPasswordAttempts = 5

// LinkTokenPayload OAuth 首次匹配确认流的中间态。
//
// 第一阶段（/auth/google、/auth/github）已验证 provider 凭证并拉取身份，
// GitHub 的 code 一次性、Google 的 credential 短时效，用户输密码期间不能
// 重放原始凭证——已验证身份暂存于此，由一次性 link_token 引用。
type LinkTokenPayload struct {
	// Provider 提供方："google" | "github"
	Provider string
	// ProviderUID 提供方稳定用户 ID（google sub / github id）
	ProviderUID string
	// Email 已验证的 provider 邮箱（email 匹配键）
	Email string
	// GithubLogin GitHub 用户名（仅 github，主页链接片段，可空）
	GithubLogin string
	// AvatarURL 提供方头像（可空）
	AvatarURL string
}

// LinkTokenStore link_token 存储端口（infrastructure 提供 Redis 实现）。
type LinkTokenStore interface {
	// Issue 签发一次性 token 并存储 payload，TTL 由调用方给定。
	Issue(ctx context.Context, payload *LinkTokenPayload, ttl time.Duration) (string, error)
	// Get 读取 payload，不消费（密码错误可重试）。
	Get(ctx context.Context, token string) (*LinkTokenPayload, error)
	// Consume 一次性删除（绑定成功或错误超限后调用）。
	Consume(ctx context.Context, token string) error
	// IncrAttempts 密码错误计数 +1，返回累计值；计数窗口与 token 生命周期一致。
	IncrAttempts(ctx context.Context, token string) (int, error)
}

// ErrLinkTokenInvalid token 不存在或已过期/作废。
var ErrLinkTokenInvalid = shared.BadRequest("绑定确认已过期，请重新发起登录")

// LinkConfirmationRequiredError OAuth email 匹配到已有账号且未绑定该 provider。
//
// 非 DomainError：携带 confirm 流所需数据，HTTP 层 errors.As 捕获后组装
// 409 响应（code=link_confirmation_required + link_token + 脱敏邮箱 + has_password）。
type LinkConfirmationRequiredError struct {
	Token       string
	Email       string // 已脱敏
	HasPassword bool
	// Provider 提供方展示名（"Google"/"GitHub"），前端弹窗文案直接使用
	Provider string
}

func (e *LinkConfirmationRequiredError) Error() string {
	return fmt.Sprintf("该邮箱 %s 已注册账号，输入密码确认绑定", e.Email)
}

// maskEmail 脱敏邮箱：local 首字符 + *** + @domain（a***@x.com）。
func maskEmail(s string) string {
	at := strings.LastIndex(s, "@")
	if at <= 0 {
		return "***"
	}
	return s[:1] + "***" + s[at:]
}

// newLinkConfirmation 首次匹配分支共用：签发 token 并构造确认错误。
// 绑定信息（provider id/login/avatar）由 confirm 阶段从 payload 恢复，
// 此处不写库——密码确认前不得动账号数据。
func newLinkConfirmation(ctx context.Context, tokens LinkTokenStore, u *user.User, payload *LinkTokenPayload) (*LinkConfirmationRequiredError, error) {
	token, err := tokens.Issue(ctx, payload, linkTokenTTL)
	if err != nil {
		return nil, shared.Internal("签发绑定确认凭证失败", err)
	}
	return &LinkConfirmationRequiredError{
		Token:       token,
		Email:       maskEmail(payload.Email),
		HasPassword: u.PasswordHash().String() != "",
		Provider:    providerDisplayName(payload.Provider),
	}, nil
}

// applyProviderBinding 将已验证的 provider 身份绑定到既有账号。
//
// login handler 直接登录路径与 confirm 确认路径共用：github 每次刷新 login
// （用户可能在 GitHub 改名），头像仅在账号无头像时回填。
// 返回是否有变更（调用方据此决定是否 Save）。
func applyProviderBinding(u *user.User, payload *LinkTokenPayload) bool {
	changed := false
	switch payload.Provider {
	case "google":
		if u.GoogleID() == nil {
			u.SetGoogleID(payload.ProviderUID)
			changed = true
		}
	case "github":
		if u.GithubID() == nil {
			u.SetGithubID(payload.ProviderUID)
			changed = true
		}
		// GitHub 用户可能改名，每次登录刷新 login（主页链接片段）；
		// 空 login 跳过，防止异常响应把已回填的有效 login 覆盖成空串。
		if payload.GithubLogin != "" {
			if login := u.GithubLogin(); login == nil || *login != payload.GithubLogin {
				u.SetGithubLogin(payload.GithubLogin)
				changed = true
			}
		}
	}
	if payload.AvatarURL != "" && u.AvatarURL() == "" {
		u.UpdateProfile(payload.AvatarURL, u.Bio())
		changed = true
	}
	return changed
}

// ConfirmLinkInput 绑定确认入参。
type ConfirmLinkInput struct {
	LinkToken string
	Password  string
}

// ConfirmLinkHandler 绑定确认用例：验证账号密码后绑定 OAuth 身份并登录。
type ConfirmLinkHandler struct {
	userRepo user.UserRepository
	tokens   LinkTokenStore
	hasher   PasswordHasher
	bus      appshared.EventBus
}

// NewConfirmLinkHandler 构造绑定确认用例。
func NewConfirmLinkHandler(repo user.UserRepository, tokens LinkTokenStore, hasher PasswordHasher, bus appshared.EventBus) *ConfirmLinkHandler {
	return &ConfirmLinkHandler{userRepo: repo, tokens: tokens, hasher: hasher, bus: bus}
}

// Handle 执行绑定确认：验 token → 验密码 → 绑定 → 返回 userID。
// session 创建交由 CreateSessionHandler（与其他登录方式同构）。
func (h *ConfirmLinkHandler) Handle(ctx context.Context, in ConfirmLinkInput) (LoginOutput, error) {
	payload, err := h.tokens.Get(ctx, in.LinkToken)
	if err != nil {
		// token 不存在/过期/作废统一提示过期；存储故障等原样上抛，不伪装成客户端错误
		if shared.IsDomainError(err, shared.CodeNotFound) {
			return LoginOutput{}, ErrLinkTokenInvalid
		}
		return LoginOutput{}, err
	}
	email, err := user.ParseEmail(payload.Email)
	if err != nil {
		return LoginOutput{}, ErrLinkTokenInvalid
	}

	u, err := h.userRepo.FindByEmail(ctx, email)
	if err != nil {
		if shared.IsDomainError(err, shared.CodeNotFound) {
			return LoginOutput{}, ErrLinkTokenInvalid // 账号已被删除，等价过期
		}
		return LoginOutput{}, err
	}

	// 并发窗口：确认期间该 provider 身份已被其他账号绑定（如另一浏览器完成绑定）。
	if bound, err := findUserByProviderID(ctx, h.userRepo, payload); err != nil {
		return LoginOutput{}, err
	} else if bound != nil && bound.GetID() != u.GetID() {
		return LoginOutput{}, shared.Conflict("该" + providerDisplayName(payload.Provider) + "身份已绑定其他账号")
	}

	// 无密码账号（OAuth 建号存空哈希）：不能在本流程内补设，
	// 引导走忘记密码邮箱验证后再回来绑定。
	if u.PasswordHash().String() == "" {
		return LoginOutput{}, shared.Forbidden("该账号未设置密码，请先通过「忘记密码」设置密码后再绑定")
	}

	if err := h.hasher.Compare(u.PasswordHash(), in.Password); err != nil {
		attempts, aerr := h.tokens.IncrAttempts(ctx, in.LinkToken)
		if aerr != nil {
			log.Warn().Err(aerr).Msg("绑定确认密码错误计数失败")
		}
		if attempts >= maxLinkPasswordAttempts {
			// 作废失败必须上抛：token 残留时第 6 次输入正确密码仍会完成绑定
			if err := h.tokens.Consume(ctx, in.LinkToken); err != nil {
				return LoginOutput{}, err
			}
		}
		return LoginOutput{}, user.ErrInvalidCredentials
	}

	if !u.CanLogin() {
		return LoginOutput{}, user.ErrAccountDisabled
	}

	// 密码已验证：立即消费 token，之后任何失败（如 Save 失败）都不允许同 token 重放。
	// 消费后流程失败的用户需重走 OAuth 第一阶段重新签发，可接受。
	if err := h.tokens.Consume(ctx, in.LinkToken); err != nil {
		return LoginOutput{}, err
	}

	if changed := applyProviderBinding(u, payload); changed {
		if err := h.userRepo.Save(ctx, u); err != nil {
			return LoginOutput{}, err
		}
	}
	if err := h.bus.Publish(ctx, []shared.DomainEvent{NewUserLoggedIn(u.GetID(), payload.Provider)}); err != nil {
		log.Warn().Err(err).Msg("发布绑定登录事件失败")
	}
	return LoginOutput{UserID: u.GetID().String()}, nil
}

// findUserByProviderID 按 payload 的 provider 分派查找（nil=未绑定）。
func findUserByProviderID(ctx context.Context, repo user.UserRepository, payload *LinkTokenPayload) (*user.User, error) {
	var (
		u   *user.User
		err error
	)
	switch payload.Provider {
	case "google":
		u, err = repo.FindByGoogleID(ctx, payload.ProviderUID)
	case "github":
		u, err = repo.FindByGithubID(ctx, payload.ProviderUID)
	default:
		return nil, shared.BadRequest("未知的登录方式")
	}
	if err != nil {
		if shared.IsDomainError(err, shared.CodeNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return u, nil
}

// providerDisplayName provider 的展示名（错误信息用）。
func providerDisplayName(provider string) string {
	switch provider {
	case "google":
		return "Google"
	case "github":
		return "GitHub"
	}
	return provider
}
