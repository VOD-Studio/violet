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

// 用户管理相关错误定义
var (
	// ErrInvalidRole 无效的用户角色
	ErrInvalidRole = errors.New("无效的用户角色")
	// ErrCannotModifySelf 不能修改自己的角色或状态
	ErrCannotModifySelf = errors.New("不能修改自己的角色或状态")
	// ErrEmptyUserIDs 空的用户 ID 列表
	ErrEmptyUserIDs = errors.New("用户 ID 列表不能为空")
	// ErrCannotModifySuperAdmin 不能操作超级管理员账户
	ErrCannotModifySuperAdmin = errors.New("普通管理员无法操作超级管理员账户")
	// ErrUsernameExists 用户名已存在
	ErrUsernameExists = errors.New("用户名已存在")
	// ErrEmailExists 邮箱已存在
	ErrEmailExists = errors.New("邮箱已存在")
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

// UserFilterParams 用户筛选参数
type UserFilterParams struct {
	// Search 搜索关键词（匹配用户名或邮箱）
	Search string
	// Role 角色筛选
	Role string
	// IsActive 状态筛选（true=启用，false=禁用，空=全部）
	IsActive *bool
}

// ListUsers 分页查询用户列表（支持搜索和筛选）
func (s *UserService) ListUsers(ctx context.Context, page, limit int, filters UserFilterParams) (*ListUsersResult, error) {
	log.Info().Str("service", "UserService").Str("operation", "ListUsers").
		Int("page", page).Int("limit", limit).
		Str("search", filters.Search).Str("role", filters.Role).
		Msg("查询用户列表")

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	// 构建查询参数
	params := generated.ListUsersParams{
		Limit:  int32(limit),
		Offset: int32(offset),
	}
	if filters.Search != "" {
		params.Search = sql.NullString{String: filters.Search, Valid: true}
	}
	if filters.Role != "" {
		params.Role = sql.NullString{String: filters.Role, Valid: true}
	}
	if filters.IsActive != nil {
		params.IsActive = sql.NullBool{Bool: *filters.IsActive, Valid: true}
	}

	log.Debug().Str("query", "ListUsers").Msg("执行数据库查询")
	users, err := s.queries.ListUsers(ctx, params)
	if err != nil {
		log.Error().Err(err).Msg("查询用户列表失败")
		return nil, fmt.Errorf("查询用户列表失败: %w", err)
	}

	// 构建统计参数
	countParams := generated.CountUsersWithFiltersParams{}
	if filters.Search != "" {
		countParams.Search = sql.NullString{String: filters.Search, Valid: true}
	}
	if filters.Role != "" {
		countParams.Role = sql.NullString{String: filters.Role, Valid: true}
	}
	if filters.IsActive != nil {
		countParams.IsActive = sql.NullBool{Bool: *filters.IsActive, Valid: true}
	}

	log.Debug().Str("query", "CountUsersWithFilters").Msg("统计用户总数")
	total, err := s.queries.CountUsersWithFilters(ctx, countParams)
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

// BatchUpdateUserStatus 批量更新用户启用/禁用状态
func (s *UserService) BatchUpdateUserStatus(ctx context.Context, userIDs []uuid.UUID, isActive bool) ([]*generated.User, error) {
	log.Info().Str("service", "UserService").Str("operation", "BatchUpdateUserStatus").
		Int("count", len(userIDs)).Bool("is_active", isActive).Msg("批量更新用户状态")

	if len(userIDs) == 0 {
		log.Warn().Msg("用户 ID 列表为空")
		return nil, ErrEmptyUserIDs
	}

	// 执行批量更新
	err := s.queries.BatchUpdateUserStatus(ctx, generated.BatchUpdateUserStatusParams{
		Column1:  userIDs,
		IsActive: isActive,
	})
	if err != nil {
		log.Error().Err(err).Msg("批量更新用户状态失败")
		return nil, fmt.Errorf("批量更新用户状态失败: %w", err)
	}

	// 获取更新后的用户列表
	users, err := s.queries.GetUsersByIDs(ctx, userIDs)
	if err != nil {
		log.Error().Err(err).Msg("获取更新后的用户列表失败")
		return nil, fmt.Errorf("获取更新后的用户列表失败: %w", err)
	}

	log.Info().Int("count", len(users)).Bool("is_active", isActive).Msg("批量更新用户状态成功")
	return users, nil
}

// BatchUpdateUserRole 批量更新用户角色
func (s *UserService) BatchUpdateUserRole(ctx context.Context, userIDs []uuid.UUID, role string) ([]*generated.User, error) {
	log.Info().Str("service", "UserService").Str("operation", "BatchUpdateUserRole").
		Int("count", len(userIDs)).Str("role", role).Msg("批量更新用户角色")

	if len(userIDs) == 0 {
		log.Warn().Msg("用户 ID 列表为空")
		return nil, ErrEmptyUserIDs
	}

	// 验证角色值
	if !validRoles[role] {
		log.Warn().Str("role", role).Msg("无效的用户角色")
		return nil, ErrInvalidRole
	}

	// 获取 role_id（superadmin 没有对应的 role_id）
	var roleID sql.NullInt32
	if role != "superadmin" {
		roleRecord, err := s.queries.GetRoleByName(ctx, role)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				log.Warn().Str("role", role).Msg("角色不存在")
			} else {
				log.Error().Err(err).Str("role", role).Msg("获取角色 ID 失败")
			}
		} else {
			roleID = sql.NullInt32{Int32: roleRecord.ID, Valid: true}
		}
	}

	// 批量更新每个用户的角色
	for _, userID := range userIDs {
		// 更新 role 字符串
		_, err := s.queries.UpdateUserRole(ctx, generated.UpdateUserRoleParams{
			ID:   userID,
			Role: role,
		})
		if err != nil {
			log.Error().Err(err).Str("user_id", userID.String()).Msg("更新用户角色失败")
			continue
		}

		// 更新 role_id
		if roleID.Valid {
			err = s.queries.UpdateUserRoleByID(ctx, generated.UpdateUserRoleByIDParams{
				ID:     userID,
				RoleID: roleID,
			})
			if err != nil {
				log.Error().Err(err).Str("user_id", userID.String()).Msg("更新用户 role_id 失败")
			}
		}
	}

	// 获取更新后的用户列表
	users, err := s.queries.GetUsersByIDs(ctx, userIDs)
	if err != nil {
		log.Error().Err(err).Msg("获取更新后的用户列表失败")
		return nil, fmt.Errorf("获取更新后的用户列表失败: %w", err)
	}

	log.Info().Int("count", len(users)).Str("role", role).Msg("批量更新用户角色成功")
	return users, nil
}

// UpdateUserRole 更新用户角色（同时更新 role 字符串和 role_id 外键）
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

	// 更新 role 字符串
	log.Debug().Str("query", "UpdateUserRole").Str("user_id", targetUserID.String()).Msg("更新用户角色字符串")
	user, err := s.queries.UpdateUserRole(ctx, generated.UpdateUserRoleParams{
		ID:   targetUserID,
		Role: role,
	})
	if err != nil {
		log.Error().Err(err).Str("user_id", targetUserID.String()).Msg("更新用户角色失败")
		return nil, fmt.Errorf("更新用户角色失败: %w", err)
	}

	// 获取对应的 role_id 并更新
	if role != "superadmin" {
		roleRecord, err := s.queries.GetRoleByName(ctx, role)
		if err != nil {
			if !errors.Is(err, sql.ErrNoRows) {
				log.Error().Err(err).Str("role", role).Msg("获取角色 ID 失败")
			}
		} else {
			err = s.queries.UpdateUserRoleByID(ctx, generated.UpdateUserRoleByIDParams{
				ID:     targetUserID,
				RoleID: sql.NullInt32{Int32: roleRecord.ID, Valid: true},
			})
			if err != nil {
				log.Error().Err(err).Str("user_id", targetUserID.String()).Msg("更新用户 role_id 失败")
			} else {
				user.RoleID = sql.NullInt32{Int32: roleRecord.ID, Valid: true}
			}
		}
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

// GetUsersByIDs 根据 ID 列表获取用户信息
func (s *UserService) GetUsersByIDs(ctx context.Context, userIDs []uuid.UUID) ([]*generated.User, error) {
	log.Info().Str("service", "UserService").Str("operation", "GetUsersByIDs").
		Int("count", len(userIDs)).Msg("查询用户信息")

	users, err := s.queries.GetUsersByIDs(ctx, userIDs)
	if err != nil {
		log.Error().Err(err).Msg("查询用户信息失败")
		return nil, fmt.Errorf("查询用户信息失败: %w", err)
	}

	log.Info().Int("count", len(users)).Msg("用户信息查询成功")
	return users, nil
}

// GetUserByID 根据单个 ID 获取用户详情
func (s *UserService) GetUserByID(ctx context.Context, userID uuid.UUID) (*generated.User, error) {
	log.Info().Str("service", "UserService").Str("operation", "GetUserByID").
		Str("user_id", userID.String()).Msg("查询用户详情")

	user, err := s.queries.GetUserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			log.Warn().Str("user_id", userID.String()).Msg("用户不存在")
			return nil, ErrUserNotFound
		}
		log.Error().Err(err).Msg("查询用户详情失败")
		return nil, fmt.Errorf("查询用户详情失败: %w", err)
	}

	log.Info().Str("user_id", userID.String()).Msg("用户详情查询成功")
	return user, nil
}

// CreateUserParams 创建用户参数
type CreateUserParams struct {
	Username string
	Email    string
	Password string
	Role     string
	IsActive bool
}

// CreateUser 管理员创建新用户
func (s *UserService) CreateUser(ctx context.Context, params CreateUserParams) (*generated.User, error) {
	log.Info().Str("service", "UserService").Str("operation", "CreateUser").
		Str("username", params.Username).Str("email", params.Email).Msg("创建新用户")

	// 验证角色
	if !validRoles[params.Role] {
		return nil, ErrInvalidRole
	}

	// 检查用户名是否已存在
	_, err := s.queries.GetUserByUsername(ctx, params.Username)
	if err == nil {
		return nil, ErrUsernameExists
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("查询用户名失败: %w", err)
	}

	// 检查邮箱是否已存在
	_, err = s.queries.GetUserByEmail(ctx, params.Email)
	if err == nil {
		return nil, ErrEmailExists
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("查询邮箱失败: %w", err)
	}

	// 密码哈希
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(params.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("密码哈希失败: %w", err)
	}

	user, err := s.queries.CreateUser(ctx, generated.CreateUserParams{
		Username:      params.Username,
		Email:         params.Email,
		PasswordHash:  string(hashedPassword),
		Role:          params.Role,
		EmailVerified: true,
		IsActive:      params.IsActive,
	})
	if err != nil {
		return nil, fmt.Errorf("创建用户失败: %w", err)
	}

	log.Info().Str("user_id", user.ID.String()).Str("username", params.Username).Msg("用户创建成功")
	return user, nil
}

// UpdateUserByAdminParams 管理员更新用户参数
type UpdateUserByAdminParams struct {
	Username      string
	Email         string
	Role          string
	IsActive      bool
	EmailVerified bool
	Bio           string
}

// UpdateUserByAdmin 管理员更新用户信息
func (s *UserService) UpdateUserByAdmin(ctx context.Context, targetUserID uuid.UUID, params UpdateUserByAdminParams) (*generated.User, error) {
	log.Info().Str("service", "UserService").Str("operation", "UpdateUserByAdmin").
		Str("user_id", targetUserID.String()).Msg("管理员更新用户信息")

	// 验证角色
	if !validRoles[params.Role] {
		return nil, ErrInvalidRole
	}

	// 检查用户是否存在
	_, err := s.queries.GetUserByID(ctx, targetUserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("查询用户失败: %w", err)
	}

	user, err := s.queries.UpdateUserByAdmin(ctx, generated.UpdateUserByAdminParams{
		ID:            targetUserID,
		Username:      params.Username,
		Email:         params.Email,
		Role:          params.Role,
		IsActive:      params.IsActive,
		EmailVerified: params.EmailVerified,
		Bio:           sql.NullString{String: params.Bio, Valid: params.Bio != ""},
	})
	if err != nil {
		return nil, fmt.Errorf("更新用户信息失败: %w", err)
	}

	log.Info().Str("user_id", targetUserID.String()).Msg("用户信息更新成功")
	return user, nil
}

// DeleteUser 删除用户
func (s *UserService) DeleteUser(ctx context.Context, targetUserID uuid.UUID) error {
	log.Info().Str("service", "UserService").Str("operation", "DeleteUser").
		Str("user_id", targetUserID.String()).Msg("删除用户")

	// 检查用户是否存在
	_, err := s.queries.GetUserByID(ctx, targetUserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrUserNotFound
		}
		return fmt.Errorf("查询用户失败: %w", err)
	}

	err = s.queries.DeleteUser(ctx, targetUserID)
	if err != nil {
		return fmt.Errorf("删除用户失败: %w", err)
	}

	log.Info().Str("user_id", targetUserID.String()).Msg("用户删除成功")
	return nil
}
