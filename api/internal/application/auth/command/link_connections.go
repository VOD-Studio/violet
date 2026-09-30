package command

import (
	"context"
	"strconv"

	"github.com/rs/zerolog/log"

	appshared "blog-api/internal/application/shared"
	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/user"
)

// ============================================================
// OAuth 绑定/解绑（设置页「登录方式」管理，登录态操作）
// ============================================================

// BindingsDTO 登录方式绑定状态（绑定/解绑接口的返回体）。
type BindingsDTO struct {
	HasPassword  bool `json:"has_password"`
	GoogleBound  bool `json:"google_bound"`
	GithubBound  bool `json:"github_bound"`
}

func bindingsOf(u *user.User) BindingsDTO {
	return BindingsDTO{
		HasPassword: u.PasswordHash().String() != "",
		GoogleBound: u.GoogleID() != nil,
		GithubBound: u.GithubID() != nil,
	}
}

// BindGoogleInput 绑定 Google 入参。
type BindGoogleInput struct {
	UserID     string
	Credential string // Google access token（implicit flow 前端拿到）
}

// BindGithubInput 绑定 GitHub 入参。
type BindGithubInput struct {
	UserID string
	Code   string // GitHub OAuth 授权码（authorize 跳转回调拿到）
}

// BindProviderHandler 设置页绑定 OAuth 用例。
//
// 与登录路径的关键差异：身份锚定当前登录账号（UserID 来自 session），
// 不做 email 匹配——用户可能想把「邮箱不同的 GitHub 账号」绑到本账号。
type BindProviderHandler struct {
	userRepo user.UserRepository
	creds    *OAuthCredentials
	bus      appshared.EventBus
}

// NewBindProviderHandler 构造绑定用例。
func NewBindProviderHandler(repo user.UserRepository, creds *OAuthCredentials, bus appshared.EventBus) *BindProviderHandler {
	return &BindProviderHandler{userRepo: repo, creds: creds, bus: bus}
}

// BindGoogle 绑定 Google：验证 credential → 未被占用 → 绑定到当前账号。
func (h *BindProviderHandler) BindGoogle(ctx context.Context, in BindGoogleInput) (BindingsDTO, error) {
	profile, err := fetchGoogleProfile(ctx, in.Credential)
	if err != nil {
		return BindingsDTO{}, err
	}
	uid, err := shared.ParseID(in.UserID)
	if err != nil {
		return BindingsDTO{}, err
	}
	u, err := h.userRepo.FindByID(ctx, uid)
	if err != nil {
		return BindingsDTO{}, err
	}
	if u.GoogleID() != nil {
		return BindingsDTO{}, shared.BadRequest("该账号已绑定 Google")
	}
	if err := h.ensureProviderFree(ctx, "google", profile.Subject, u); err != nil {
		return BindingsDTO{}, err
	}
	if changed := applyProviderBinding(u, &LinkTokenPayload{
		Provider: "google", ProviderUID: profile.Subject, AvatarURL: profile.Picture,
	}); changed {
		if err := h.userRepo.Save(ctx, u); err != nil {
			return BindingsDTO{}, err
		}
	}
	h.publishBound(ctx, u, "google")
	return bindingsOf(u), nil
}

// BindGithub 绑定 GitHub：code 换身份 → 未被占用 → 绑定到当前账号。
func (h *BindProviderHandler) BindGithub(ctx context.Context, in BindGithubInput) (BindingsDTO, error) {
	profile, err := fetchGithubProfile(ctx, in.Code, h.creds)
	if err != nil {
		return BindingsDTO{}, err
	}
	uid, err := shared.ParseID(in.UserID)
	if err != nil {
		return BindingsDTO{}, err
	}
	u, err := h.userRepo.FindByID(ctx, uid)
	if err != nil {
		return BindingsDTO{}, err
	}
	if u.GithubID() != nil {
		return BindingsDTO{}, shared.BadRequest("该账号已绑定 GitHub")
	}
	if err := h.ensureProviderFree(ctx, "github", strconv.Itoa(profile.ID), u); err != nil {
		return BindingsDTO{}, err
	}
	if changed := applyProviderBinding(u, &LinkTokenPayload{
		Provider: "github", ProviderUID: strconv.Itoa(profile.ID),
		GithubLogin: profile.Login, AvatarURL: profile.AvatarURL,
	}); changed {
		if err := h.userRepo.Save(ctx, u); err != nil {
			return BindingsDTO{}, err
		}
	}
	h.publishBound(ctx, u, "github")
	return bindingsOf(u), nil
}

// ensureProviderFree 校验 provider 身份未被任何账号占用。
// 已被本人账号持有不会走到这（调用前已挡）；被他人账号持有 → 409。
func (h *BindProviderHandler) ensureProviderFree(ctx context.Context, provider, providerUID string, self *user.User) error {
	bound, err := findUserByProviderUID(ctx, h.userRepo, provider, providerUID)
	if err != nil {
		return err
	}
	if bound != nil && bound.GetID() != self.GetID() {
		return shared.Conflict("该" + providerDisplayName(provider) + "身份已绑定其他账号")
	}
	return nil
}

func (h *BindProviderHandler) publishBound(ctx context.Context, u *user.User, provider string) {
	if err := h.bus.Publish(ctx, []shared.DomainEvent{NewProviderBound(u.GetID(), provider)}); err != nil {
		log.Warn().Err(err).Msg("发布 OAuth 绑定事件失败")
	}
}

// UnbindInput 解绑入参。
type UnbindInput struct {
	UserID   string
	Provider string // "google" | "github"
}

// UnbindProviderHandler 设置页解绑 OAuth 用例。
type UnbindProviderHandler struct {
	userRepo user.UserRepository
	bus      appshared.EventBus
}

// NewUnbindProviderHandler 构造解绑用例。
func NewUnbindProviderHandler(repo user.UserRepository, bus appshared.EventBus) *UnbindProviderHandler {
	return &UnbindProviderHandler{userRepo: repo, bus: bus}
}

// Handle 解绑 OAuth：前置校验解绑后至少保留一种登录方式（密码或剩余 OAuth）。
func (h *UnbindProviderHandler) Handle(ctx context.Context, in UnbindInput) (BindingsDTO, error) {
	uid, err := shared.ParseID(in.UserID)
	if err != nil {
		return BindingsDTO{}, err
	}
	u, err := h.userRepo.FindByID(ctx, uid)
	if err != nil {
		return BindingsDTO{}, err
	}

	switch in.Provider {
	case "google":
		if u.GoogleID() == nil {
			return BindingsDTO{}, shared.BadRequest("该账号未绑定 Google")
		}
		if u.PasswordHash().String() == "" && u.GithubID() == nil {
			return BindingsDTO{}, shared.BadRequest("解绑后账号将没有任何登录方式，请先设置密码或绑定其他登录方式")
		}
		u.ClearGoogleID()
	case "github":
		if u.GithubID() == nil {
			return BindingsDTO{}, shared.BadRequest("该账号未绑定 GitHub")
		}
		if u.PasswordHash().String() == "" && u.GoogleID() == nil {
			return BindingsDTO{}, shared.BadRequest("解绑后账号将没有任何登录方式，请先设置密码或绑定其他登录方式")
		}
		u.ClearGithubID()
	default:
		return BindingsDTO{}, shared.BadRequest("未知的登录方式")
	}

	if err := h.userRepo.Save(ctx, u); err != nil {
		return BindingsDTO{}, err
	}
	if err := h.bus.Publish(ctx, []shared.DomainEvent{NewProviderUnbound(u.GetID(), in.Provider)}); err != nil {
		log.Warn().Err(err).Msg("发布 OAuth 解绑事件失败")
	}
	return bindingsOf(u), nil
}

// findUserByProviderUID 按 provider/uid 查找占用者（nil=未占用）。
func findUserByProviderUID(ctx context.Context, repo user.UserRepository, provider, uid string) (*user.User, error) {
	return findUserByProviderID(ctx, repo, &LinkTokenPayload{Provider: provider, ProviderUID: uid})
}
