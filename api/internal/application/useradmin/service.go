// Package useradmin 提供用户管理的应用用例。
package useradmin

import (
	"context"

	"github.com/rs/zerolog/log"

	domainuser "blog-api/internal/domain/user"
	domainuseradmin "blog-api/internal/domain/useradmin"
	"blog-api/internal/domain/shared"
)

// ListFilter 用户列表筛选条件（别名 domain 类型）
type ListFilter = domainuseradmin.ListFilter

// PasswordHasher 密码哈希端口（Hash 返回 user.PasswordHash）
type PasswordHasher interface {
	Hash(password string) (domainuser.PasswordHash, error)
}

// AuditLogger 审计日志端口
type AuditLogger interface {
	Log(ctx context.Context, action, resource, resourceID, userID, ip, ua string) error
	LogWithDetail(ctx context.Context, action, resource, resourceID, userID, ip, ua string, detail map[string]any) error
}

// Service 用户管理用例服务
type Service struct {
	store    domainuseradmin.AdminUserStore
	hasher   PasswordHasher
	auditSvc AuditLogger
}

// NewService 构造用户管理服务
func NewService(store domainuseradmin.AdminUserStore, hasher PasswordHasher, auditSvc AuditLogger) *Service {
	return &Service{store: store, hasher: hasher, auditSvc: auditSvc}
}

// UserDTO 用户读模型（管理后台）
type UserDTO struct {
	ID            string `json:"id"`
	Username      string `json:"username"`
	Email         string `json:"email"`
	Role          string `json:"role"`
	EmailVerified bool   `json:"email_verified"`
	IsActive      bool   `json:"is_active"`
	Bio           string `json:"bio"`
	Avatar        string `json:"avatar"`
	CreatedAt     string `json:"created_at"`
}

// List 用户列表（分页 + 筛选）
func (s *Service) List(ctx context.Context, filter ListFilter, page, limit int) ([]UserDTO, int64, error) {
	result, err := s.store.List(ctx, filter, page, limit)
	if err != nil {
		return nil, 0, err
	}
	dtos := make([]UserDTO, 0, len(result.Users))
	for i := range result.Users {
		dtos = append(dtos, toDTO(&result.Users[i]))
	}
	return dtos, result.Total, nil
}

// GetDetail 用户详情
func (s *Service) GetDetail(ctx context.Context, id string) (UserDTO, error) {
	uid, err := shared.ParseID(id)
	if err != nil {
		return UserDTO{}, err
	}
	u, err := s.store.FindByID(ctx, uid)
	if err != nil {
		return UserDTO{}, err
	}
	return toDTO(u), nil
}

// CreateInput 创建用户入参
type CreateInput struct {
	Username  string
	Email     string
	Password  string
	Role      string
	IsActive  bool
	IPAddress string
	UserAgent string
}

// Create 创建用户
//
// 安全守卫：授予 superadmin 角色需操作者本身是 superadmin（防止 admin 越权提权）。
func (s *Service) Create(ctx context.Context, in CreateInput, operatorID, operatorRole string) (UserDTO, error) {
	email, err := domainuser.ParseEmail(in.Email)
	if err != nil {
		return UserDTO{}, err
	}
	username, err := domainuser.ParseUsername(in.Username)
	if err != nil {
		return UserDTO{}, err
	}
	// 守卫：只有 superadmin 才能创建 superadmin 用户
	if domainuser.Role(in.Role).IsSuperAdmin() && !domainuser.Role(operatorRole).IsSuperAdmin() {
		return UserDTO{}, shared.Forbidden("仅超级管理员可授予超级管理员角色")
	}
	hash, err := s.hasher.Hash(in.Password)
	if err != nil {
		return UserDTO{}, shared.Internal("密码哈希失败", err)
	}
	u := domainuser.NewUser(shared.NewID(), email, username, hash)
	if err := u.ChangeRole(domainuser.Role(in.Role)); err != nil {
		return UserDTO{}, err
	}
	if in.IsActive {
		u.Activate()
	}
	if err := s.store.Save(ctx, u); err != nil {
		return UserDTO{}, err
	}
	_ = s.auditSvc.LogWithDetail(ctx, "create", "user", u.GetID().String(), operatorID, in.IPAddress, in.UserAgent, map[string]any{
		"username": in.Username, "email": in.Email, "role": in.Role,
	})
	return toDTO(u), nil
}

// UpdateInput 更新用户入参
type UpdateInput struct {
	ID          string
	Username    *string
	Email       *string
	Password    *string
	Role        *string
	IsActive    *bool
	DisplayName *string
	Bio         *string
	Avatar      *string
	IPAddress   string
	UserAgent   string
}

// Update 更新用户
//
// 安全守卫：
//   - 不可修改超级管理员的角色/状态（仅超管自身的基础信息如密码/头像可改）
//   - 不可修改自己的角色（防止自升降）
//   - 授予 superadmin 角色需操作者本身是 superadmin
//   - username 变更需持久化（修复此前 _ = un 丢弃导致用户名不更新的 bug）
func (s *Service) Update(ctx context.Context, in UpdateInput, operatorID, operatorRole string) (UserDTO, error) {
	uid, err := shared.ParseID(in.ID)
	if err != nil {
		return UserDTO{}, err
	}
	u, err := s.store.FindByID(ctx, uid)
	if err != nil {
		return UserDTO{}, err
	}
	// 操作者是否在操作自己
	isSelf := u.GetID().String() == operatorID
	// 角色变更守卫
	if in.Role != nil {
		if u.IsSuperAdmin() {
			// 不可改超管角色
			return UserDTO{}, shared.Forbidden("不可修改超级管理员的角色")
		}
		if isSelf {
			return UserDTO{}, shared.Forbidden("不可修改自己的角色")
		}
		// 授予 superadmin 需操作者是 superadmin
		if domainuser.Role(*in.Role).IsSuperAdmin() && !domainuser.Role(operatorRole).IsSuperAdmin() {
			return UserDTO{}, shared.Forbidden("仅超级管理员可授予超级管理员角色")
		}
	}
	// 状态变更守卫：不可禁用超管，不可禁用自己
	if in.IsActive != nil && !*in.IsActive {
		if u.IsSuperAdmin() {
			return UserDTO{}, shared.Forbidden("不可禁用超级管理员")
		}
		if isSelf {
			return UserDTO{}, shared.Forbidden("不可禁用自己的账户")
		}
	}

	// 应用变更
	if in.Username != nil {
		un, err := domainuser.ParseUsername(*in.Username)
		if err != nil {
			return UserDTO{}, err
		}
		u.ChangeUsername(un) // 实际持久化 username（修复此前丢弃 bug）
	}
	if in.Password != nil && *in.Password != "" {
		hash, err := s.hasher.Hash(*in.Password)
		if err != nil {
			return UserDTO{}, shared.Internal("密码哈希失败", err)
		}
		u.ChangePassword(hash)
	}
	if in.Role != nil {
		if err := u.ChangeRole(domainuser.Role(*in.Role)); err != nil {
			return UserDTO{}, err
		}
	}
	if in.IsActive != nil {
		if *in.IsActive {
			u.Activate()
		} else {
			u.Deactivate()
		}
	}
	if err := s.store.Save(ctx, u); err != nil {
		return UserDTO{}, err
	}
	_ = s.auditSvc.LogWithDetail(ctx, "update", "user", in.ID, operatorID, in.IPAddress, in.UserAgent, nil)
	return toDTO(u), nil
}

// Delete 删除用户
//
// 安全守卫：不可删除超级管理员；不可删除自己。
func (s *Service) Delete(ctx context.Context, id, operatorID, operatorRole, ip, ua string) error {
	uid, err := shared.ParseID(id)
	if err != nil {
		return err
	}
	u, err := s.store.FindByID(ctx, uid)
	if err != nil {
		return err
	}
	if u.IsSuperAdmin() {
		return shared.Forbidden("不可删除超级管理员")
	}
	if u.GetID().String() == operatorID {
		return shared.Forbidden("不可删除自己")
	}
	if err := s.store.Delete(ctx, uid); err != nil {
		return err
	}
	return s.auditSvc.Log(ctx, "delete", "user", id, operatorID, ip, ua)
}

// UpdateUserRole 修改单个用户角色
//
// 安全守卫：不可改超管角色；不可改自己角色；授予 superadmin 需操作者是 superadmin。
func (s *Service) UpdateUserRole(ctx context.Context, id, role, operatorID, operatorRole, ip, ua string) error {
	uid, err := shared.ParseID(id)
	if err != nil {
		return err
	}
	u, err := s.store.FindByID(ctx, uid)
	if err != nil {
		return err
	}
	if u.IsSuperAdmin() {
		return shared.Forbidden("不可修改超级管理员的角色")
	}
	if u.GetID().String() == operatorID {
		return shared.Forbidden("不可修改自己的角色")
	}
	if domainuser.Role(role).IsSuperAdmin() && !domainuser.Role(operatorRole).IsSuperAdmin() {
		return shared.Forbidden("仅超级管理员可授予超级管理员角色")
	}
	if err := u.ChangeRole(domainuser.Role(role)); err != nil {
		return err
	}
	if err := s.store.Save(ctx, u); err != nil {
		return err
	}
	return s.auditSvc.LogWithDetail(ctx, "update_role", "user", id, operatorID, ip, ua, map[string]any{"role": role})
}

// UpdateUserStatus 修改单个用户状态
//
// 安全守卫：不可禁用超管；不可禁用自己（启用不受限）。
func (s *Service) UpdateUserStatus(ctx context.Context, id string, isActive bool, operatorID, operatorRole, ip, ua string) error {
	uid, err := shared.ParseID(id)
	if err != nil {
		return err
	}
	u, err := s.store.FindByID(ctx, uid)
	if err != nil {
		return err
	}
	if !isActive {
		if u.IsSuperAdmin() {
			return shared.Forbidden("不可禁用超级管理员")
		}
		if u.GetID().String() == operatorID {
			return shared.Forbidden("不可禁用自己的账户")
		}
	}
	if isActive {
		u.Activate()
	} else {
		u.Deactivate()
	}
	if err := s.store.Save(ctx, u); err != nil {
		return err
	}
	return s.auditSvc.LogWithDetail(ctx, "update_status", "user", id, operatorID, ip, ua, map[string]any{"is_active": isActive})
}

// BatchUpdateStatus 批量启用/禁用
//
// 安全守卫：目标集合含超级管理员或操作者自己时拒绝（禁用场景）。
func (s *Service) BatchUpdateStatus(ctx context.Context, idStrs []string, isActive bool, operatorID, operatorRole, ip, ua string) (int64, error) {
	ids, err := parseIDs(idStrs)
	if err != nil {
		return 0, err
	}
	if !isActive {
		// 禁用场景需校验目标不含超管和自己
		users, err := s.store.FindByIDs(ctx, ids)
		if err != nil {
			return 0, err
		}
		for _, u := range users {
			if u.IsSuperAdmin() {
				return 0, shared.Forbidden("选中的用户中包含超级管理员，不可批量禁用")
			}
			if u.GetID().String() == operatorID {
				return 0, shared.Forbidden("选中的用户中包含自己，不可批量禁用")
			}
		}
	}
	affected, err := s.store.BatchUpdateStatus(ctx, ids, isActive)
	if err != nil {
		return 0, err
	}
	log.Info().Int64("affected", affected).Bool("is_active", isActive).Msg("批量更新用户状态")
	return affected, s.auditSvc.LogWithDetail(ctx, "batch_update_status", "user", "", operatorID, ip, ua, map[string]any{
		"count": affected, "is_active": isActive,
	})
}

// BatchUpdateRole 批量修改角色
//
// 安全守卫：目标含超级管理员时拒绝（不可改超管角色）；授予 superadmin 需操作者是 superadmin；
// 目标含操作者自己时拒绝（不可改自己角色）。
func (s *Service) BatchUpdateRole(ctx context.Context, idStrs []string, role, operatorID, operatorRole, ip, ua string) (int64, error) {
	ids, err := parseIDs(idStrs)
	if err != nil {
		return 0, err
	}
	// 授予 superadmin 需操作者是 superadmin
	if domainuser.Role(role).IsSuperAdmin() && !domainuser.Role(operatorRole).IsSuperAdmin() {
		return 0, shared.Forbidden("仅超级管理员可授予超级管理员角色")
	}
	users, err := s.store.FindByIDs(ctx, ids)
	if err != nil {
		return 0, err
	}
	for _, u := range users {
		if u.IsSuperAdmin() {
			return 0, shared.Forbidden("选中的用户中包含超级管理员，不可批量修改其角色")
		}
		if u.GetID().String() == operatorID {
			return 0, shared.Forbidden("选中的用户中包含自己，不可批量修改自己角色")
		}
	}
	affected, err := s.store.BatchUpdateRole(ctx, ids, role)
	if err != nil {
		return 0, err
	}
	log.Info().Int64("affected", affected).Str("role", role).Msg("批量更新用户角色")
	return affected, s.auditSvc.LogWithDetail(ctx, "batch_update_role", "user", "", operatorID, ip, ua, map[string]any{
		"count": affected, "role": role,
	})
}

func parseIDs(idStrs []string) ([]shared.ID, error) {
	ids := make([]shared.ID, 0, len(idStrs))
	for _, s := range idStrs {
		id, err := shared.ParseID(s)
		if err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, nil
}

func toDTO(u *domainuser.User) UserDTO {
	dto := UserDTO{
		ID: u.GetID().String(), Username: u.Username().String(), Email: u.Email().String(),
		Role: string(u.Role()), EmailVerified: u.EmailVerified(), IsActive: u.IsActive(),
		Avatar: u.AvatarURL(), Bio: u.Bio(),
		CreatedAt: u.CreatedAt().Format("2006-01-02T15:04:05Z07:00"),
	}
	return dto
}

