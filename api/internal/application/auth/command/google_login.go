package command

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"

	"github.com/rs/zerolog/log"

	appshared "blog-api/internal/application/shared"
	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/user"
)

// GoogleLoginInput 谷歌登录入参
type GoogleLoginInput struct {
	Credential string
}

// GoogleLoginHandler 谷歌登录用例
type GoogleLoginHandler struct {
	userRepo user.UserRepository
	clientID string
	tokens   LinkTokenStore
	bus      appshared.EventBus
}

// NewGoogleLoginHandler 构造谷歌登录用例。
// 仅校验 Google 凭证并找到/创建用户，返回 userID；session 创建交由 CreateSessionHandler。
// email 匹配到已有账号且未绑定 Google 时返回 LinkConfirmationRequiredError（409 确认流）。
func NewGoogleLoginHandler(
	repo user.UserRepository,
	clientID string,
	tokens LinkTokenStore,
	bus appshared.EventBus,
) *GoogleLoginHandler {
	return &GoogleLoginHandler{
		userRepo: repo,
		clientID: clientID,
		tokens:   tokens,
		bus:      bus,
	}
}

// Handle 执行谷歌登录
func (h *GoogleLoginHandler) Handle(ctx context.Context, in GoogleLoginInput) (LoginOutput, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://www.googleapis.com/oauth2/v3/userinfo", nil)
	if err != nil {
		return LoginOutput{}, shared.Internal("构建 Google API 请求失败", err)
	}
	req.Header.Set("Authorization", "Bearer "+in.Credential)
	
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return LoginOutput{}, shared.Internal("请求 Google API 失败", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return LoginOutput{}, user.ErrInvalidCredentials
	}
	
	var payload struct {
		Email   string `json:"email"`
		Subject string `json:"sub"`
		Picture string `json:"picture"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return LoginOutput{}, shared.Internal("解析 Google 响应失败", err)
	}

	if payload.Email == "" {
		return LoginOutput{}, shared.BadRequest("Google 账号缺少邮箱信息")
	}

	email, err := user.ParseEmail(payload.Email)
	if err != nil {
		return LoginOutput{}, err
	}

	subject := payload.Subject

	// 查找顺序：绑定身份（provider id）优先，email 其次。绑定后用户改 Google 侧
	// primary email 仍按 id 命中直接登录——只按 email 查会在匹配失败后走建号
	// 分支，SetGoogleID 撞唯一索引报 500。
	u, err := h.userRepo.FindByGoogleID(ctx, subject)
	if err != nil && !shared.IsDomainError(err, shared.CodeNotFound) {
		return LoginOutput{}, err
	}
	if u == nil {
		u, err = h.userRepo.FindByEmail(ctx, email)
		if err != nil && !shared.IsDomainError(err, shared.CodeNotFound) {
			return LoginOutput{}, err
		}
	}

	if u == nil {
		// 用户不存在，创建新用户。
		// 密码存空哈希：OAuth 建号用户没有密码（bcrypt 对空哈希必然校验失败，
		// 不构成可登录凭证），has_password=false 供前端展示「设置密码」入口；
		// 需要密码登录时走忘记密码邮箱验证流程补设。
		username, err := generateGoogleUsername(ctx, email, h.userRepo)
		if err != nil {
			return LoginOutput{}, shared.Internal("生成用户名失败", err)
		}

		u = user.NewUser(shared.NewID(), email, username, user.NewPasswordHash(""))
		u.VerifyEmail() // 谷歌账号已验证
		u.SetGoogleID(subject)
		
		if payload.Picture != "" {
			u.UpdateProfile(payload.Picture, "")
		}

		u.Activate()          // 激活账号
		if err := h.userRepo.Save(ctx, u); err != nil {
			return LoginOutput{}, err
		}
	} else {
		// 用户存在。未绑定 Google：首次匹配，进入密码确认流（PRD-0033：
		// 静默绑定会让「在 provider 挂他人已验证邮箱」直接登入他人账号，
		// 必须由账号密码确认后才能绑定）。
		if u.GoogleID() == nil {
			confirm, err := newLinkConfirmation(ctx, h.tokens, u, &LinkTokenPayload{
				Provider: "google", ProviderUID: subject,
				Email: email.String(), AvatarURL: payload.Picture,
			})
			if err != nil {
				return LoginOutput{}, err
			}
			return LoginOutput{}, confirm
		}
		// 该 email 账号已绑定其他 Google 身份（同 email 双 Google 账号，罕见）：
		// 不允许覆盖，联系管理员处理。
		if *u.GoogleID() != subject {
			return LoginOutput{}, shared.Conflict("该邮箱账号已绑定其他 Google 身份，请联系管理员")
		}

		if changed := applyProviderBinding(u, &LinkTokenPayload{
			Provider: "google", ProviderUID: subject, AvatarURL: payload.Picture,
		}); changed {
			if err := h.userRepo.Save(ctx, u); err != nil {
				return LoginOutput{}, err
			}
		}

		if !u.CanLogin() {
			return LoginOutput{}, user.ErrAccountDisabled
		}
	}

	if err := h.bus.Publish(ctx, []shared.DomainEvent{NewUserLoggedIn(u.GetID(), "google")}); err != nil {
		log.Warn().Err(err).Msg("发布 Google 登录事件失败")
	}
	return LoginOutput{UserID: u.GetID().String()}, nil
}

func generateGoogleUsername(ctx context.Context, email user.Email, userRepo user.UserRepository) (user.Username, error) {
	base := strings.Split(email.String(), "@")[0]
	base = regexp.MustCompile(`[^a-zA-Z0-9_\x{4e00}-\x{9fa5}]`).ReplaceAllString(base, "_")
	if len(base) < 3 {
		base += "user"
	}
	if len(base) > 26 {
		base = base[:26]
	}

	u, err := user.ParseUsername(base)
	if err == nil {
		exists, err := userRepo.ExistsByUsername(ctx, u)
		if err == nil && !exists {
			return u, nil
		}
	}

	for i := 0; i < 5; i++ {
		suffixBytes := make([]byte, 2)
		rand.Read(suffixBytes)
		suffix := hex.EncodeToString(suffixBytes)
		u, err = user.ParseUsername(base + "_" + suffix)
		if err == nil {
			exists, err := userRepo.ExistsByUsername(ctx, u)
			if err == nil && !exists {
				return u, nil
			}
		}
	}

	return user.Username{}, errors.New("无法生成唯一的用户名")
}
