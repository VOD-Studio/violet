package command

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"regexp"
	"strings"

	"google.golang.org/api/idtoken"

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
	userRepo   user.UserRepository
	jwt        appshared.TokenService
	tokenStore appshared.TokenStore
	clientID   string
	hasher     PasswordHasher
}

// NewGoogleLoginHandler 构造谷歌登录用例
func NewGoogleLoginHandler(
	repo user.UserRepository,
	jwt appshared.TokenService,
	tokenStore appshared.TokenStore,
	clientID string,
	hasher PasswordHasher,
) *GoogleLoginHandler {
	return &GoogleLoginHandler{
		userRepo:   repo,
		jwt:        jwt,
		tokenStore: tokenStore,
		clientID:   clientID,
		hasher:     hasher,
	}
}

// Handle 执行谷歌登录
func (h *GoogleLoginHandler) Handle(ctx context.Context, in GoogleLoginInput) (LoginOutput, error) {
	payload, err := idtoken.Validate(ctx, in.Credential, h.clientID)
	if err != nil {
		return LoginOutput{}, user.ErrInvalidCredentials
	}

	emailStr, ok := payload.Claims["email"].(string)
	if !ok {
		return LoginOutput{}, shared.BadRequest("Google token missing email")
	}

	email, err := user.ParseEmail(emailStr)
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
		u.Activate()          // 激活账号
		if err := h.userRepo.Save(ctx, u); err != nil {
			return LoginOutput{}, err
		}
	} else {
		// 用户存在，检查并绑定 Google ID
		if u.GoogleID() == nil {
			u.SetGoogleID(subject)
			if err := h.userRepo.Save(ctx, u); err != nil {
				return LoginOutput{}, err
			}
		}
		
		if !u.CanLogin() {
			return LoginOutput{}, user.ErrAccountDisabled
		}
	}

	// 生成 token pair
	pair, err := h.jwt.GenerateTokenPair(appshared.TokenInput{
		UserID:              u.GetID().String(),
		Email:               u.Email().String(),
		Role:                string(u.Role()),
		IsBuiltinSuperAdmin: u.IsBuiltinSuperAdmin(),
	})
	if err != nil {
		return LoginOutput{}, shared.Internal("生成令牌失败", err)
	}

	// 存储 refresh token
	if err := h.tokenStore.Save(ctx, u.GetID().String(), pair.RefreshToken); err != nil {
		return LoginOutput{}, shared.Internal("存储 refresh token 失败", err)
	}

	return LoginOutput{TokenPair: pair, UserID: u.GetID().String()}, nil
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
