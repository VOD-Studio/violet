// Package service 提供业务逻辑层，封装数据访问和业务规则
package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"time"

	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/bcrypt"

	"blog-api/internal/repository/generated"
)

// VerifyEmail 验证邮箱
func (s *AuthService) VerifyEmail(ctx context.Context, email, code string) error {
	log.Info().Str("service", "AuthService").Str("operation", "VerifyEmail").Str("email", email).Msg("开始验证邮箱")
	key := "verify:" + email

	log.Info().Str("target", "Redis").Str("key", key).Msg("获取验证码数据")
	data, err := s.getVerificationData(ctx, key)
	if err != nil {
		log.Warn().Str("email", email).Msg("验证码无效或已过期")
		return ErrInvalidVerificationCode
	}

	if data.Attempts >= 5 {
		log.Warn().Str("email", email).Int("attempts", data.Attempts).Msg("验证码尝试次数过多")
		s.redis.Del(ctx, key)
		return ErrTooManyAttempts
	}

	codeHash := sha256Hash(code)

	if codeHash != data.CodeHash {
		data.Attempts++
		s.storeVerificationData(ctx, key, *data)
		log.Warn().Str("email", email).Int("attempts", data.Attempts).Msg("验证码错误")
		return ErrInvalidVerificationCode
	}

	log.Info().Str("target", "Redis").Str("key", key).Msg("删除已使用的验证码")
	s.redis.Del(ctx, key)

	log.Debug().Str("query", "GetUserByEmail").Str("email", email).Msg("查询用户信息")
	user, err := s.queries.GetUserByEmail(ctx, email)
	if err != nil {
		log.Error().Err(err).Str("email", email).Msg("查询用户失败")
		return fmt.Errorf("查询用户失败: %w", err)
	}

	log.Debug().Str("query", "UpdateUserActive").Str("user_id", user.ID.String()).Msg("更新用户激活状态")
	if err := s.queries.UpdateUserActive(ctx, generated.UpdateUserActiveParams{
		ID:       user.ID,
		IsActive: true,
	}); err != nil {
		log.Error().Err(err).Str("user_id", user.ID.String()).Msg("更新用户激活状态失败")
		return fmt.Errorf("更新用户激活状态失败: %w", err)
	}

	log.Debug().Str("query", "UpdateUserVerified").Str("user_id", user.ID.String()).Msg("更新邮箱验证状态")
	if err := s.queries.UpdateUserVerified(ctx, generated.UpdateUserVerifiedParams{
		ID:            user.ID,
		EmailVerified: true,
	}); err != nil {
		log.Error().Err(err).Str("user_id", user.ID.String()).Msg("更新邮箱验证状态失败")
		return fmt.Errorf("更新邮箱验证状态失败: %w", err)
	}

	log.Info().Str("user_id", user.ID.String()).Str("email", email).Msg("邮箱验证成功")
	return nil
}

// ForgotPassword 发送密码重置验证码
func (s *AuthService) ForgotPassword(ctx context.Context, email string) error {
	log.Info().Str("service", "AuthService").Str("operation", "ForgotPassword").Str("email", email).Msg("开始密码重置流程")

	log.Debug().Str("query", "GetUserByEmail").Str("email", email).Msg("查询用户信息")
	user, err := s.queries.GetUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			log.Info().Str("email", email).Msg("用户不存在，但返回成功以保护隐私")
			return nil
		}
		log.Error().Err(err).Str("email", email).Msg("查询用户失败")
		return fmt.Errorf("查询用户失败: %w", err)
	}

	code, err := generateVerificationCode()
	if err != nil {
		log.Error().Err(err).Msg("生成重置码失败")
		return fmt.Errorf("生成重置码失败: %w", err)
	}

	key := "reset:" + email
	log.Info().Str("target", "Redis").Str("key", key).Msg("存储重置码")
	if err := s.storeVerificationCode(ctx, key, code); err != nil {
		log.Error().Err(err).Str("email", email).Msg("存储重置码失败")
		return fmt.Errorf("存储重置码失败: %w", err)
	}

	log.Info().Str("target", "EmailService").Str("email", email).Msg("发送密码重置邮件")
	if err := s.emailService.SendPasswordResetCode(ctx, user.Email, code); err != nil {
		log.Warn().Err(err).Str("email", email).Msg("发送密码重置邮件失败")
	}

	log.Info().Str("email", email).Msg("密码重置邮件已发送")
	return nil
}

// ResetPassword 重置密码
func (s *AuthService) ResetPassword(ctx context.Context, email, code, newPassword string) error {
	log.Info().Str("service", "AuthService").Str("operation", "ResetPassword").Str("email", email).Msg("开始重置密码")
	key := "reset:" + email

	log.Info().Str("target", "Redis").Str("key", key).Msg("获取重置码数据")
	data, err := s.getVerificationData(ctx, key)
	if err != nil {
		log.Warn().Str("email", email).Msg("重置码无效或已过期")
		return ErrInvalidVerificationCode
	}

	if data.Attempts >= 5 {
		log.Warn().Str("email", email).Int("attempts", data.Attempts).Msg("重置码尝试次数过多")
		s.redis.Del(ctx, key)
		return ErrTooManyAttempts
	}

	codeHash := sha256Hash(code)
	if codeHash != data.CodeHash {
		data.Attempts++
		s.storeVerificationData(ctx, key, *data)
		log.Warn().Str("email", email).Int("attempts", data.Attempts).Msg("重置码错误")
		return ErrInvalidVerificationCode
	}

	log.Info().Str("target", "Redis").Str("key", key).Msg("删除已使用的重置码")
	s.redis.Del(ctx, key)

	log.Debug().Str("query", "GetUserByEmail").Str("email", email).Msg("查询用户信息")
	user, err := s.queries.GetUserByEmail(ctx, email)
	if err != nil {
		log.Error().Err(err).Str("email", email).Msg("查询用户失败")
		return fmt.Errorf("查询用户失败: %w", err)
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Error().Err(err).Msg("密码哈希失败")
		return fmt.Errorf("密码哈希失败: %w", err)
	}

	log.Debug().Str("query", "UpdateUserPassword").Str("user_id", user.ID.String()).Msg("更新用户密码")
	if err := s.queries.UpdateUserPassword(ctx, generated.UpdateUserPasswordParams{
		ID:           user.ID,
		PasswordHash: string(hashedPassword),
	}); err != nil {
		log.Error().Err(err).Str("user_id", user.ID.String()).Msg("更新密码失败")
		return fmt.Errorf("更新密码失败: %w", err)
	}

	refreshKey := "refresh:" + user.ID.String()
	log.Info().Str("target", "Redis").Str("key", refreshKey).Msg("吊销所有刷新令牌")
	s.redis.Del(ctx, refreshKey)

	log.Info().Str("user_id", user.ID.String()).Str("email", email).Msg("密码重置成功")
	return nil
}

// generateVerificationCode 生成 6 位数字验证码
func generateVerificationCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// sha256Hash 计算字符串的 SHA256 哈希值
func sha256Hash(input string) string {
	h := sha256.Sum256([]byte(input))
	return hex.EncodeToString(h[:])
}

// storeVerificationCode 将验证码存储到 Redis
func (s *AuthService) storeVerificationCode(ctx context.Context, key, code string) error {
	data := VerificationData{
		CodeHash: sha256Hash(code),
		Attempts: 0,
	}
	return s.storeVerificationData(ctx, key, data)
}

// storeVerificationData 将验证数据序列化后存入 Redis
func (s *AuthService) storeVerificationData(ctx context.Context, key string, data VerificationData) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("序列化验证数据失败: %w", err)
	}
	return s.redis.Set(ctx, key, string(jsonData), 10*time.Minute).Err()
}

// getVerificationData 从 Redis 获取验证数据并反序列化
func (s *AuthService) getVerificationData(ctx context.Context, key string) (*VerificationData, error) {
	jsonData, err := s.redis.Get(ctx, key).Result()
	if err != nil {
		return nil, err
	}

	var data VerificationData
	if err := json.Unmarshal([]byte(jsonData), &data); err != nil {
		return nil, fmt.Errorf("反序列化验证数据失败: %w", err)
	}

	return &data, nil
}
