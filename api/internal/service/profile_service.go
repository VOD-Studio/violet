// Package service 提供业务逻辑层，封装数据访问和业务规则
package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/bcrypt"

	"blog-api/internal/repository/generated"
)

// GetUserByID 按 ID 查询用户信息
func (s *AuthService) GetUserByID(ctx context.Context, userID string) (*generated.User, error) {
	log.Debug().Str("service", "AuthService").Str("operation", "GetUserByID").Str("user_id", userID).Msg("查询用户信息")

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("无效的用户ID")
		return nil, fmt.Errorf("无效的用户 ID: %w", err)
	}

	log.Debug().Str("query", "GetUserByID").Str("user_id", userID).Msg("执行数据库查询")
	user, err := s.queries.GetUserByID(ctx, userUUID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			log.Warn().Str("user_id", userID).Msg("用户不存在")
			return nil, ErrUserNotFound
		}
		log.Error().Err(err).Str("user_id", userID).Msg("查询用户失败")
		return nil, fmt.Errorf("查询用户失败: %w", err)
	}

	return user, nil
}

// UpdateProfile 更新用户个人资料
func (s *AuthService) UpdateProfile(ctx context.Context, userID, username, bio, avatarURL string) (*generated.User, error) {
	log.Info().Str("service", "AuthService").Str("operation", "UpdateProfile").Str("user_id", userID).Str("username", username).Msg("开始更新用户资料")

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("无效的用户ID")
		return nil, fmt.Errorf("无效的用户 ID: %w", err)
	}

	log.Debug().Str("query", "GetUserByUsername").Str("username", username).Msg("检查用户名是否可用")
	existing, err := s.queries.GetUserByUsername(ctx, username)
	if err == nil && existing.ID != userUUID {
		log.Warn().Str("username", username).Str("user_id", userID).Msg("用户名已被占用")
		return nil, ErrUsernameAlreadyExists
	}
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		log.Error().Err(err).Str("username", username).Msg("查询用户名失败")
		return nil, fmt.Errorf("查询用户名失败: %w", err)
	}

	var bioNull sql.NullString
	if bio != "" {
		bioNull = sql.NullString{String: bio, Valid: true}
	}
	var avatarNull sql.NullString
	if avatarURL != "" {
		avatarNull = sql.NullString{String: avatarURL, Valid: true}
	}

	log.Debug().Str("query", "UpdateUserProfile").Str("user_id", userID).Msg("更新用户资料")
	user, err := s.queries.UpdateUserProfile(ctx, generated.UpdateUserProfileParams{
		ID:        userUUID,
		Username:  username,
		Bio:       bioNull,
		AvatarUrl: avatarNull,
	})
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("更新个人资料失败")
		return nil, fmt.Errorf("更新个人资料失败: %w", err)
	}

	log.Info().Str("user_id", userID).Msg("用户资料更新成功")
	return user, nil
}

// UpdatePassword 修改密码（需验证旧密码）
func (s *AuthService) UpdatePassword(ctx context.Context, userID, oldPassword, newPassword string) error {
	log.Info().Str("service", "AuthService").Str("operation", "UpdatePassword").Str("user_id", userID).Msg("开始修改密码")

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("无效的用户ID")
		return fmt.Errorf("无效的用户 ID: %w", err)
	}

	log.Debug().Str("query", "GetUserByID").Str("user_id", userID).Msg("查询用户信息")
	user, err := s.queries.GetUserByID(ctx, userUUID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			log.Warn().Str("user_id", userID).Msg("用户不存在")
			return ErrUserNotFound
		}
		log.Error().Err(err).Str("user_id", userID).Msg("查询用户失败")
		return fmt.Errorf("查询用户失败: %w", err)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(oldPassword)); err != nil {
		log.Warn().Str("user_id", userID).Msg("旧密码错误")
		return ErrInvalidCredentials
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Error().Err(err).Msg("密码哈希失败")
		return fmt.Errorf("密码哈希失败: %w", err)
	}

	log.Debug().Str("query", "UpdateUserPassword").Str("user_id", userID).Msg("更新用户密码")
	if err := s.queries.UpdateUserPassword(ctx, generated.UpdateUserPasswordParams{
		ID:           userUUID,
		PasswordHash: string(hashedPassword),
	}); err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("更新密码失败")
		return fmt.Errorf("更新密码失败: %w", err)
	}

	log.Info().Str("user_id", userID).Msg("密码修改成功")
	return nil
}
