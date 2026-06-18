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
func (s *Service) Create(ctx context.Context, in CreateInput, operatorID string) (UserDTO, error) {
	email, err := domainuser.ParseEmail(in.Email)
	if err != nil {
		return UserDTO{}, err
	}
	username, err := domainuser.ParseUsername(in.Username)
	if err != nil {
		return UserDTO{}, err
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
func (s *Service) Update(ctx context.Context, in UpdateInput, operatorID string) (UserDTO, error) {
	uid, err := shared.ParseID(in.ID)
	if err != nil {
		return UserDTO{}, err
	}
	u, err := s.store.FindByID(ctx, uid)
	if err != nil {
		return UserDTO{}, err
	}
	if in.Username != nil {
		un, err := domainuser.ParseUsername(*in.Username)
		if err != nil {
			return UserDTO{}, err
		}
		_ = un // username 变更需聚合根方法，暂透传
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
func (s *Service) Delete(ctx context.Context, id, operatorID, ip, ua string) error {
	uid, err := shared.ParseID(id)
	if err != nil {
		return err
	}
	if err := s.store.Delete(ctx, uid); err != nil {
		return err
	}
	return s.auditSvc.Log(ctx, "delete", "user", id, operatorID, ip, ua)
}

// UpdateUserRole 修改单个用户角色
func (s *Service) UpdateUserRole(ctx context.Context, id, role, operatorID, ip, ua string) error {
	uid, err := shared.ParseID(id)
	if err != nil {
		return err
	}
	u, err := s.store.FindByID(ctx, uid)
	if err != nil {
		return err
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
func (s *Service) UpdateUserStatus(ctx context.Context, id string, isActive bool, operatorID, ip, ua string) error {
	uid, err := shared.ParseID(id)
	if err != nil {
		return err
	}
	u, err := s.store.FindByID(ctx, uid)
	if err != nil {
		return err
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
func (s *Service) BatchUpdateStatus(ctx context.Context, idStrs []string, isActive bool, operatorID, ip, ua string) (int64, error) {
	ids, err := parseIDs(idStrs)
	if err != nil {
		return 0, err
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
func (s *Service) BatchUpdateRole(ctx context.Context, idStrs []string, role, operatorID, ip, ua string) (int64, error) {
	ids, err := parseIDs(idStrs)
	if err != nil {
		return 0, err
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

