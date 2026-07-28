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

	"blog-api/internal/brand"
	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/user"
)

type GithubLoginInput struct {
	Credential string
}

type GithubLoginHandler struct {
	userRepo     user.UserRepository
	clientID     string
	clientSecret string
	hasher       PasswordHasher
}

func NewGithubLoginHandler(
	repo user.UserRepository,
	clientID string,
	clientSecret string,
	hasher PasswordHasher,
) *GithubLoginHandler {
	return &GithubLoginHandler{
		userRepo:     repo,
		clientID:     clientID,
		clientSecret: clientSecret,
		hasher:       hasher,
	}
}

func (h *GithubLoginHandler) Handle(ctx context.Context, in GithubLoginInput) (LoginOutput, error) {
	// 1. Get access token
	tokenReqBody, _ := json.Marshal(map[string]string{
		"client_id":     h.clientID,
		"client_secret": h.clientSecret,
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
	
	// 3. Get user email
	emailStr := userInfo.Email
	if emailStr == "" {
		reqEmail, err := http.NewRequestWithContext(ctx, "GET", "https://api.github.com/user/emails", nil)
		if err == nil {
			reqEmail.Header.Set("Authorization", "Bearer "+tokenRes.AccessToken)
			reqEmail.Header.Set("Accept", "application/json")
			reqEmail.Header.Set("User-Agent", brand.GitHubOAuthUA)
			respEmail, err := http.DefaultClient.Do(reqEmail)
			if err == nil {
				defer respEmail.Body.Close()
				var emails []struct {
					Email    string `json:"email"`
					Primary  bool   `json:"primary"`
					Verified bool   `json:"verified"`
				}
				if json.NewDecoder(respEmail.Body).Decode(&emails) == nil {
					for _, e := range emails {
						if e.Primary && e.Verified {
							emailStr = e.Email
							break
						}
					}
					if emailStr == "" && len(emails) > 0 {
						emailStr = emails[0].Email
					}
				}
			}
		}
	}

	if emailStr == "" {
		return LoginOutput{}, shared.BadRequest("Github 账号缺少邮箱信息")
	}

	email, err := user.ParseEmail(emailStr)
	if err != nil {
		return LoginOutput{}, err
	}

	u, err := h.userRepo.FindByEmail(ctx, email)
	if err != nil && !shared.IsDomainError(err, shared.CodeNotFound) {
		return LoginOutput{}, err
	}

	if u == nil {
		b := make([]byte, 16)
		rand.Read(b)
		randomPwd := hex.EncodeToString(b)

		hash, err := h.hasher.Hash(randomPwd)
		if err != nil {
			return LoginOutput{}, shared.Internal("密码哈希失败", err)
		}

		username, err := generateGithubUsername(ctx, userInfo.Login, emailStr, h.userRepo)
		if err != nil {
			return LoginOutput{}, shared.Internal("生成用户名失败", err)
		}

		u = user.NewUser(shared.NewID(), email, username, hash)
		u.VerifyEmail()
		u.SetGithubID(githubIDStr)
		
		if userInfo.AvatarURL != "" {
			u.UpdateProfile(userInfo.AvatarURL, "")
		}

		u.Activate()
		if err := h.userRepo.Save(ctx, u); err != nil {
			return LoginOutput{}, err
		}
	} else {
		changed := false
		if u.GithubID() == nil {
			u.SetGithubID(githubIDStr)
			changed = true
		}
		
		if userInfo.AvatarURL != "" && u.AvatarURL() == "" {
			u.UpdateProfile(userInfo.AvatarURL, u.Bio())
			changed = true
		}

		if changed {
			if err := h.userRepo.Save(ctx, u); err != nil {
				return LoginOutput{}, err
			}
		}
		
		if !u.CanLogin() {
			return LoginOutput{}, user.ErrAccountDisabled
		}
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
