package command

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/rs/zerolog/log"

	appshared "blog-api/internal/application/shared"
	"blog-api/internal/brand"
	domainsettings "blog-api/internal/domain/settings"
	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/user"
)

type GithubLoginInput struct {
	Credential string
}

type GithubLoginHandler struct {
	userRepo user.UserRepository
	creds    *OAuthCredentials
	tokens   LinkTokenStore
	bus      appshared.EventBus
}

// NewGithubLoginHandler 构造 GitHub 登录用例。
// email 匹配到已有账号且未绑定 GitHub 时返回 LinkConfirmationRequiredError（409 确认流）。
func NewGithubLoginHandler(
	repo user.UserRepository,
	creds *OAuthCredentials,
	tokens LinkTokenStore,
	bus appshared.EventBus,
) *GithubLoginHandler {
	return &GithubLoginHandler{
		userRepo: repo,
		creds:    creds,
		tokens:   tokens,
		bus:      bus,
	}
}

func (h *GithubLoginHandler) Handle(ctx context.Context, in GithubLoginInput) (LoginOutput, error) {
	if h.creds.GithubClientID() == "" || h.creds.GithubClientSecret() == "" {
		return LoginOutput{}, domainsettings.ErrOAuthNotConfigured
	}

	// 1. Get access token（凭据实时读取：后台写入后无需重启即生效）
	tokenReqBody, _ := json.Marshal(map[string]string{
		"client_id":     h.creds.GithubClientID(),
		"client_secret": h.creds.GithubClientSecret(),
		"code":          in.Credential,
	})
	req, err := http.NewRequestWithContext(ctx, "POST", "https://github.com/login/oauth/access_token", bytes.NewBuffer(tokenReqBody))
	if err != nil {
		return LoginOutput{}, shared.Internal("构建 Github API 请求失败", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", brand.GitHubOAuthUA)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return LoginOutput{}, shared.Internal("请求 Github API 失败", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		// 读取详细错误
		var errBody bytes.Buffer
		_, _ = errBody.ReadFrom(resp.Body)
		return LoginOutput{}, shared.Internal("Github 令牌交换失败: "+errBody.String(), errors.New(resp.Status))
	}

	var tokenRes struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenRes); err != nil {
		return LoginOutput{}, shared.Internal("解析 Github 令牌失败", err)
	}
	if tokenRes.AccessToken == "" {
		return LoginOutput{}, user.ErrInvalidCredentials
	}

	// 2. Get user info
	reqInfo, err := http.NewRequestWithContext(ctx, "GET", "https://api.github.com/user", nil)
	if err != nil {
		return LoginOutput{}, shared.Internal("构建 Github User 请求失败", err)
	}
	reqInfo.Header.Set("Authorization", "Bearer "+tokenRes.AccessToken)
	reqInfo.Header.Set("Accept", "application/json")
	reqInfo.Header.Set("User-Agent", brand.GitHubOAuthUA)

	respInfo, err := http.DefaultClient.Do(reqInfo)
	if err != nil {
		return LoginOutput{}, shared.Internal("请求 Github User 失败", err)
	}
	defer respInfo.Body.Close()

	if respInfo.StatusCode != http.StatusOK {
		var errBody bytes.Buffer
		_, _ = errBody.ReadFrom(respInfo.Body)
		return LoginOutput{}, shared.Internal("请求 Github User 失败: "+errBody.String(), errors.New(respInfo.Status))
	}

	var userInfo struct {
		ID        int    `json:"id"`
		Login     string `json:"login"`
		AvatarURL string `json:"avatar_url"`
		Email     string `json:"email"`
	}
	if err := json.NewDecoder(respInfo.Body).Decode(&userInfo); err != nil {
		return LoginOutput{}, shared.Internal("解析 Github User 失败", err)
	}

	githubIDStr := strconv.Itoa(userInfo.ID)
	
	// 3. Get user email：只认 primary+verified（身份匹配键安全底线）。
	// userInfo.Email 是用户公开的 primary（GitHub 要求验证后才能设 primary）可直接信任；
	// /user/emails 里非 primary 或未验证的地址一律不用——未验证 email 参与匹配
	// 等于允许「在 GitHub 挂他人邮箱」接管对应 violet 账号。
	emailStr := userInfo.Email
	if emailStr == "" {
		emailStr = fetchGithubPrimaryEmail(ctx, tokenRes.AccessToken)
	}
	if emailStr == "" {
		return LoginOutput{}, shared.BadRequest("GitHub 账号未提供已验证的主邮箱，无法完成登录。请在 GitHub 设置的 Emails 页将常用邮箱设为已验证的主邮箱后重试。")
	}

	email, err := user.ParseEmail(emailStr)
	if err != nil {
		return LoginOutput{}, err
	}

	// 查找顺序：绑定身份（provider id）优先，email 其次（同 Google 登录，
	// 绑定后用户改 GitHub primary email 仍按 id 命中，防建号分支撞唯一索引）。
	u, err := h.userRepo.FindByGithubID(ctx, githubIDStr)
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
		// 密码存空哈希（同 Google 登录：OAuth 建号无密码，忘记密码流程补设）
		username, err := generateGithubUsername(ctx, userInfo.Login, emailStr, h.userRepo)
		if err != nil {
			return LoginOutput{}, shared.Internal("生成用户名失败", err)
		}

		u = user.NewUser(shared.NewID(), email, username, user.NewPasswordHash(""))
		u.VerifyEmail()
		u.SetGithubID(githubIDStr)
		// 空 login（API 边缘响应）不写入：保持 nil 语义（角标只显图标不可跳），避免拼出裸主页坏链
		if userInfo.Login != "" {
			u.SetGithubLogin(userInfo.Login)
		}
		
		if userInfo.AvatarURL != "" {
			u.UpdateProfile(userInfo.AvatarURL, "")
		}

		u.Activate()
		if err := h.userRepo.Save(ctx, u); err != nil {
			return LoginOutput{}, err
		}
	} else {
		// 用户存在。未绑定 GitHub：首次匹配，进入密码确认流（PRD-0033：
		// 静默绑定会让「在 GitHub 挂他人已验证邮箱」直接登入他人账号）。
		if u.GithubID() == nil {
			confirm, err := newLinkConfirmation(ctx, h.tokens, u, &LinkTokenPayload{
				Provider: "github", ProviderUID: githubIDStr,
				Email: email.String(), GithubLogin: userInfo.Login, AvatarURL: userInfo.AvatarURL,
			})
			if err != nil {
				return LoginOutput{}, err
			}
			return LoginOutput{}, confirm
		}
		// 该 email 账号已绑定其他 GitHub 身份（同 email 双 GitHub 账号，罕见）：
		// 不允许覆盖，联系管理员处理。
		if *u.GithubID() != githubIDStr {
			return LoginOutput{}, shared.Conflict("该邮箱账号已绑定其他 GitHub 身份，请联系管理员")
		}

		if changed := applyProviderBinding(u, &LinkTokenPayload{
			Provider: "github", ProviderUID: githubIDStr,
			GithubLogin: userInfo.Login, AvatarURL: userInfo.AvatarURL,
		}); changed {
			if err := h.userRepo.Save(ctx, u); err != nil {
				return LoginOutput{}, err
			}
		}

		if !u.CanLogin() {
			return LoginOutput{}, user.ErrAccountDisabled
		}
	}

	if err := h.bus.Publish(ctx, []shared.DomainEvent{NewUserLoggedIn(u.GetID(), "github")}); err != nil {
		log.Warn().Err(err).Msg("发布 Github 登录事件失败")
	}
	return LoginOutput{UserID: u.GetID().String()}, nil
}

func generateGithubUsername(ctx context.Context, login string, emailStr string, userRepo user.UserRepository) (user.Username, error) {
	base := login
	if base == "" {
		base = strings.Split(emailStr, "@")[0]
	}
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

// githubEmail /user/emails 端点的条目形态。
type githubEmail struct {
	Email    string `json:"email"`
	Primary  bool   `json:"primary"`
	Verified bool   `json:"verified"`
}

// pickPrimaryVerifiedEmail 返回列表中 primary 且 verified 的邮箱，无则空串。
// 不做任何兜底：未验证地址不得作为身份匹配键（防接管）。
func pickPrimaryVerifiedEmail(emails []githubEmail) string {
	for _, e := range emails {
		if e.Primary && e.Verified {
			return e.Email
		}
	}
	return ""
}

// fetchGithubPrimaryEmail 拉 /user/emails 并取 primary+verified 邮箱。
//
// 网络失败、响应异常、无可用邮箱统一返回空串：对调用方语义等价（都走
// 「未提供已验证的主邮箱」拒绝路径），不向用户暴露 GitHub 侧的失败细节。
func fetchGithubPrimaryEmail(ctx context.Context, token string) string {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.github.com/user/emails", nil)
	if err != nil {
		return ""
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", brand.GitHubOAuthUA)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	var emails []githubEmail
	if json.NewDecoder(resp.Body).Decode(&emails) != nil {
		return ""
	}
	return pickPrimaryVerifiedEmail(emails)
}
