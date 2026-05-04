package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"blog-api/internal/repository/generated"
)

// 用户管理相关错误定义
var (
	// ErrInvalidRole 无效的用户角色
	ErrInvalidRole = errors.New("无效的用户角色")
	// ErrCannotModifySelf 不能修改自己的角色
	ErrCannotModifySelf = errors.New("不能修改自己的角色")
)

// 合法的用户角色列表
var validRoles = map[string]bool{
	"user":       true,
	"admin":      true,
	"superadmin": true,
}

// UserService 用户管理业务服务
type UserService struct {
	queries *generated.Queries
}

// NewUserService 创建用户管理服务实例
func NewUserService(queries *generated.Queries) *UserService {
	return &UserService{queries: queries}
}

// ListUsersResult 用户列表查询结果
type ListUsersResult struct {
	// Users 用户列表
	Users []*generated.User
	// Total 总数
	Total int64
	// Page 当前页码
	Page int
	// Limit 每页数量
	Limit int
}

// ListUsers 分页查询用户列表
func (s *UserService) ListUsers(ctx context.Context, page, limit int) (*ListUsersResult, error) {
	log.Info().Str("service", "UserService").Str("operation", "ListUsers").
		Int("page", page).Int("limit", limit).Msg("查询用户列表")

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	log.Debug().Str("query", "ListUsers").Msg("执行数据库查询")
	users, err := s.queries.ListUsers(ctx, generated.ListUsersParams{
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		log.Error().Err(err).Msg("查询用户列表失败")
		return nil, fmt.Errorf("查询用户列表失败: %w", err)
	}

	log.Debug().Str("query", "CountUsers").Msg("统计用户总数")
	total, err := s.queries.CountUsers(ctx)
	if err != nil {
		log.Error().Err(err).Msg("统计用户数失败")
		return nil, fmt.Errorf("统计用户数失败: %w", err)
	}

	log.Info().Int64("total", total).Int("count", len(users)).Msg("用户列表查询成功")
	return &ListUsersResult{
		Users: users,
		Total: total,
		Page:  page,
		Limit: limit,
	}, nil
}

// UpdateUserRole 更新用户角色
func (s *UserService) UpdateUserRole(ctx context.Context, targetUserID uuid.UUID, role string) (*generated.User, error) {
	log.Info().Str("service", "UserService").Str("operation", "UpdateUserRole").
		Str("user_id", targetUserID.String()).Str("role", role).Msg("开始更新用户角色")

	// 验证角色值
	if !validRoles[role] {
		log.Warn().Str("role", role).Msg("无效的用户角色")
		return nil, ErrInvalidRole
	}

	// 检查用户是否存在
	log.Debug().Str("query", "GetUserByID").Str("user_id", targetUserID.String()).Msg("检查用户是否存在")
	_, err := s.queries.GetUserByID(ctx, targetUserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			log.Warn().Str("user_id", targetUserID.String()).Msg("用户不存在")
			return nil, ErrUserNotFound
		}
		log.Error().Err(err).Str("user_id", targetUserID.String()).Msg("查询用户失败")
		return nil, fmt.Errorf("查询用户失败: %w", err)
	}

	// 更新角色
	log.Debug().Str("query", "UpdateUserRole").Str("user_id", targetUserID.String()).Msg("更新用户角色")
	user, err := s.queries.UpdateUserRole(ctx, generated.UpdateUserRoleParams{
		ID:   targetUserID,
		Role: role,
	})
	if err != nil {
		log.Error().Err(err).Str("user_id", targetUserID.String()).Msg("更新用户角色失败")
		return nil, fmt.Errorf("更新用户角色失败: %w", err)
	}

	log.Info().Str("user_id", targetUserID.String()).Str("role", role).Msg("用户角色更新成功")
	return user, nil
}

// UpdateUserStatus 更新用户启用/禁用状态
func (s *UserService) UpdateUserStatus(ctx context.Context, targetUserID uuid.UUID, isActive bool) (*generated.User, error) {
	// 检查用户是否存在
	_, err := s.queries.GetUserByID(ctx, targetUserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("查询用户失败: %w", err)
	}

	// 更新状态
	user, err := s.queries.UpdateUserStatus(ctx, generated.UpdateUserStatusParams{
		ID:       targetUserID,
		IsActive: isActive,
	})
	if err != nil {
		return nil, fmt.Errorf("更新用户状态失败: %w", err)
	}

	return user, nil
}
