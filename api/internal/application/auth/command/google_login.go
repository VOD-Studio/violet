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
	hasher   PasswordHasher
}

// NewGoogleLoginHandler 构造谷歌登录用例。
// 仅校验 Google 凭证并找到/创建用户，返回 userID；session 创建交由 CreateSessionHandler。
func NewGoogleLoginHandler(
	repo user.UserRepository,
	clientID string,
	hasher PasswordHasher,
) *GoogleLoginHandler {
	return &GoogleLoginHandler{
		userRepo: repo,
		clientID: clientID,
		hasher:   hasher,
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

	u, err := h.userRepo.FindByEmail(ctx, email)
	if err != nil && !shared.IsDomainError(err, shared.CodeNotFound) {
		return LoginOutput{}, err
	}

	if u == nil {
		// 用户不存在，创建新用户
		b := make([]byte, 16)
		rand.Read(b)
		randomPwd := hex.EncodeToString(b)

		hash, err := h.hasher.Hash(randomPwd)
		if err != nil {
			return LoginOutput{}, shared.Internal("密码哈希失败", err)
		}

		username, err := generateGoogleUsername(ctx, email, h.userRepo)
		if err != nil {
			return LoginOutput{}, shared.Internal("生成用户名失败", err)
		}

		u = user.NewUser(shared.NewID(), email, username, hash)
		u.VerifyEmail()       // 谷歌账号已验证
		u.SetGoogleID(subject)
		
		if payload.Picture != "" {
			u.UpdateProfile(payload.Picture, "")
		}

		u.Activate()          // 激活账号
		if err := h.userRepo.Save(ctx, u); err != nil {
			return LoginOutput{}, err
		}
	} else {
		// 用户存在，检查并绑定 Google ID
		changed := false
		if u.GoogleID() == nil {
			u.SetGoogleID(subject)
			changed = true
		}
		
		// 如果用户还没有头像，使用 Google 提供的头像
		if payload.Picture != "" && u.AvatarURL() == "" {
			u.UpdateProfile(payload.Picture, u.Bio())
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
