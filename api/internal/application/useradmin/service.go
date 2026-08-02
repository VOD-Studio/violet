// Package useradmin 提供用户管理的应用用例。
package useradmin

import (
	"context"

	"github.com/rs/zerolog/log"

	appshared "blog-api/internal/application/shared"
	"blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
	domainuseradmin "blog-api/internal/domain/useradmin"
)

// ListFilter 用户列表筛选条件（别名 domain 类型）
type ListFilter = domainuseradmin.ListFilter

// PasswordHasher 密码哈希端口（Hash 返回 user.PasswordHash）
type PasswordHasher interface {
	Hash(password string) (domainuser.PasswordHash, error)
}

// Service 用户管理用例服务
type Service struct {
	store  domainuseradmin.AdminUserStore
	hasher PasswordHasher
	bus    appshared.EventBus
}

// NewService 构造用户管理服务
//
// 审计由领域事件驱动（聚合根 RecordEvent → 应用层 Publish），
// 不再手工注入 AuditLogger。
func NewService(store domainuseradmin.AdminUserStore, hasher PasswordHasher, bus appshared.EventBus) *Service {
	return &Service{store: store, hasher: hasher, bus: bus}
}

// UserDTO 用户读模型（管理后台）
type UserDTO struct {
	ID                  string `json:"id"`
	Username            string `json:"username"`
	Email               string `json:"email"`
	Role                string `json:"role"`
	IsBuiltinSuperAdmin bool   `json:"is_builtin_super_admin"`
	EmailVerified       bool   `json:"email_verified"`
	IsActive            bool   `json:"is_active"`
	Bio                 string `json:"bio"`
	AvatarURL           string `json:"avatar_url"`
	CreatedAt           string `json:"created_at"`
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
// 安全守卫：授予 superadmin 角色需操作者是内置超管（持有 user:assign-superadmin 语义）。
// 被委派超管不能授权第三人，授权链不可传递。
func (s *Service) Create(ctx context.Context, in CreateInput, operatorID, operatorRole string, operatorIsBuiltinSuperAdmin bool) (UserDTO, error) {
	email, err := domainuser.ParseEmail(in.Email)
	if err != nil {
		return UserDTO{}, err
	}
	username, err := domainuser.ParseUsername(in.Username)
	if err != nil {
		return UserDTO{}, err
	}
	// 守卫：只有内置超管才能创建 superadmin 用户（被委派超管不可，授权链不可传递）
	if domainuser.Role(in.Role).IsSuperAdmin() && !operatorIsBuiltinSuperAdmin {
		return UserDTO{}, shared.Forbidden("仅内置超级管理员可授予超级管理员角色")
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
	// 发布聚合根事件（UserRegistered + RoleChanged + StatusChanged，审计订阅者消费）
	s.publishEvents(ctx, u)
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
	AvatarURL   *string
	IPAddress   string
	UserAgent   string
}

// Update 更新用户
//
// 安全守卫：
//   - 不可修改内置超级管理员的角色/状态（仅可改其基础信息如密码/头像）
//   - 被委派超管可被内置超管降级/禁用；被委派超管不可处置其他超管
//   - 不可修改自己的角色（防止自升降）
//   - 授予 superadmin 角色需操作者是内置超管（授权链不可传递）
//   - username 变更需持久化（修复此前 _ = un 丢弃导致用户名不更新的 bug）
func (s *Service) Update(ctx context.Context, in UpdateInput, operatorID, operatorRole string, operatorIsBuiltinSuperAdmin bool) (UserDTO, error) {
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
		if u.IsBuiltinSuperAdmin() {
			// 不可改内置超管角色
			return UserDTO{}, shared.Forbidden("不可修改内置超级管理员的角色")
		}
		// 被委派超管只能由内置超管改角色
		if u.IsSuperAdmin() && !operatorIsBuiltinSuperAdmin {
			return UserDTO{}, shared.Forbidden("仅内置超级管理员可修改其他超管的角色")
		}
		if isSelf {
			return UserDTO{}, shared.Forbidden("不可修改自己的角色")
		}
		// 授予 superadmin 需操作者是内置超管（授权链不可传递）
		if domainuser.Role(*in.Role).IsSuperAdmin() && !operatorIsBuiltinSuperAdmin {
			return UserDTO{}, shared.Forbidden("仅内置超级管理员可授予超级管理员角色")
		}
	}
	// 状态变更守卫：不可禁用内置超管；被委派超管仅内置超管可禁用；不可禁用自己
	if in.IsActive != nil && !*in.IsActive {
		if u.IsBuiltinSuperAdmin() {
			return UserDTO{}, shared.Forbidden("不可禁用内置超级管理员")
		}
		if u.IsSuperAdmin() && !operatorIsBuiltinSuperAdmin {
			return UserDTO{}, shared.Forbidden("仅内置超级管理员可禁用其他超管")
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
	s.publishEvents(ctx, u)
	return toDTO(u), nil
}

// Delete 删除用户
//
// 安全守卫：不可删除内置超级管理员；被委派超管仅内置超管可删；不可删除自己。
// 即内置超管可删除任何人（除自己和其它内置超管）。
func (s *Service) Delete(ctx context.Context, id, operatorID, operatorRole string, operatorIsBuiltinSuperAdmin bool, ip, ua string) error {
	uid, err := shared.ParseID(id)
	if err != nil {
		return err
	}
	u, err := s.store.FindByID(ctx, uid)
	if err != nil {
		return err
	}
	if u.IsBuiltinSuperAdmin() {
		return shared.Forbidden("不可删除内置超级管理员")
	}
	// 被委派超管仅内置超管可删
	if u.IsSuperAdmin() && !operatorIsBuiltinSuperAdmin {
		return shared.Forbidden("仅内置超级管理员可删除其他超管")
	}
	if u.GetID().String() == operatorID {
		return shared.Forbidden("不可删除自己")
	}
	if err := s.store.Delete(ctx, uid); err != nil {
		return err
	}
	// 删除是破坏性操作，手动构造事件发布（聚合根不可继续存在）
	if err := s.bus.Publish(ctx, []shared.DomainEvent{domainuser.NewUserDeleted(uid)}); err != nil {
		log.Warn().Err(err).Msg("发布用户删除事件失败")
	}
	return nil
}

// UpdateUserRole 修改单个用户角色
//
// 安全守卫：不可改内置超管角色；被委派超管仅内置超管可改；不可改自己角色；
// 授予 superadmin 需操作者是内置超管（授权链不可传递）。
func (s *Service) UpdateUserRole(ctx context.Context, id, role, operatorID, operatorRole string, operatorIsBuiltinSuperAdmin bool, ip, ua string) error {
	uid, err := shared.ParseID(id)
	if err != nil {
		return err
	}
	u, err := s.store.FindByID(ctx, uid)
	if err != nil {
		return err
	}
	if u.IsBuiltinSuperAdmin() {
		return shared.Forbidden("不可修改内置超级管理员的角色")
	}
	if u.IsSuperAdmin() && !operatorIsBuiltinSuperAdmin {
		return shared.Forbidden("仅内置超级管理员可修改其他超管的角色")
	}
	if u.GetID().String() == operatorID {
		return shared.Forbidden("不可修改自己的角色")
	}
	if domainuser.Role(role).IsSuperAdmin() && !operatorIsBuiltinSuperAdmin {
		return shared.Forbidden("仅内置超级管理员可授予超级管理员角色")
	}
	if err := u.ChangeRole(domainuser.Role(role)); err != nil {
		return err
	}
	if err := s.store.Save(ctx, u); err != nil {
		return err
	}
	s.publishEvents(ctx, u)
	return nil
}

// UpdateUserStatus 修改单个用户状态
//
// 安全守卫：不可禁用内置超管；被委派超管仅内置超管可禁用；不可禁用自己（启用不受限）。
func (s *Service) UpdateUserStatus(ctx context.Context, id string, isActive bool, operatorID, operatorRole string, operatorIsBuiltinSuperAdmin bool, ip, ua string) error {
	uid, err := shared.ParseID(id)
	if err != nil {
		return err
	}
	u, err := s.store.FindByID(ctx, uid)
	if err != nil {
		return err
	}
	if !isActive {
		if u.IsBuiltinSuperAdmin() {
			return shared.Forbidden("不可禁用内置超级管理员")
		}
		if u.IsSuperAdmin() && !operatorIsBuiltinSuperAdmin {
			return shared.Forbidden("仅内置超级管理员可禁用其他超管")
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
	s.publishEvents(ctx, u)
	return nil
}

// BatchUpdateStatus 批量启用/禁用
//
// 安全守卫：禁用场景下，目标含内置超管/被委派超管（操作者非内置超管时）/操作者自己时拒绝。
func (s *Service) BatchUpdateStatus(ctx context.Context, idStrs []string, isActive bool, operatorID, operatorRole string, operatorIsBuiltinSuperAdmin bool, ip, ua string) (int64, error) {
	ids, err := parseIDs(idStrs)
	if err != nil {
		return 0, err
	}
	if !isActive {
		// 禁用场景需校验目标不含内置超管/被委派超管（操作者非内置超管时）/自己
		users, err := s.store.FindByIDs(ctx, ids)
		if err != nil {
			return 0, err
		}
		for _, u := range users {
			if u.IsBuiltinSuperAdmin() {
				return 0, shared.Forbidden("选中的用户中包含内置超级管理员，不可批量禁用")
			}
			if u.IsSuperAdmin() && !operatorIsBuiltinSuperAdmin {
				return 0, shared.Forbidden("选中的用户中包含超级管理员，仅内置超管可批量禁用")
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
	s.publishBatchStatus(ctx, affected, isActive)
	return affected, nil
}

// BatchUpdateRole 批量修改角色
//
// 安全守卫：授予 superadmin 需操作者是内置超管（授权链不可传递）；
// 目标含内置超管时拒绝（不可改内置超管角色）；被委派超管仅内置超管可改；
// 目标含操作者自己时拒绝（不可改自己角色）。
func (s *Service) BatchUpdateRole(ctx context.Context, idStrs []string, role, operatorID, operatorRole string, operatorIsBuiltinSuperAdmin bool, ip, ua string) (int64, error) {
	ids, err := parseIDs(idStrs)
	if err != nil {
		return 0, err
	}
	// 授予 superadmin 需操作者是内置超管（授权链不可传递）
	if domainuser.Role(role).IsSuperAdmin() && !operatorIsBuiltinSuperAdmin {
		return 0, shared.Forbidden("仅内置超级管理员可授予超级管理员角色")
	}
	users, err := s.store.FindByIDs(ctx, ids)
	if err != nil {
		return 0, err
	}
	for _, u := range users {
		if u.IsBuiltinSuperAdmin() {
			return 0, shared.Forbidden("选中的用户中包含内置超级管理员，不可批量修改其角色")
		}
		if u.IsSuperAdmin() && !operatorIsBuiltinSuperAdmin {
			return 0, shared.Forbidden("选中的用户中包含超级管理员，仅内置超管可批量修改其角色")
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
	s.publishBatchRole(ctx, affected, role)
	return affected, nil
}

// publishEvents 发布聚合根累积的领域事件（审计订阅者消费）
func (s *Service) publishEvents(ctx context.Context, u *domainuser.User) {
	events := u.PullEvents()
	if len(events) == 0 {
		return
	}
	if err := s.bus.Publish(ctx, events); err != nil {
		log.Warn().Err(err).Msg("发布用户管理事件失败")
	}
}

// publishBatchStatus 发布批量状态变更事件（聚合根不参与批量 SQL，手动构造）
func (s *Service) publishBatchStatus(ctx context.Context, affected int64, isActive bool) {
	if err := s.bus.Publish(ctx, []shared.DomainEvent{domainuser.NewBatchUserStatusChanged(affected, isActive)}); err != nil {
		log.Warn().Err(err).Msg("发布批量状态事件失败")
	}
}

// publishBatchRole 发布批量角色变更事件（聚合根不参与批量 SQL，手动构造）
func (s *Service) publishBatchRole(ctx context.Context, affected int64, role string) {
	if err := s.bus.Publish(ctx, []shared.DomainEvent{domainuser.NewBatchUserRoleChanged(affected, role)}); err != nil {
		log.Warn().Err(err).Msg("发布批量角色事件失败")
	}
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
		Role: string(u.Role()), IsBuiltinSuperAdmin: u.IsBuiltinSuperAdmin(),
		EmailVerified: u.EmailVerified(), IsActive: u.IsActive(),
		AvatarURL: u.AvatarURL(), Bio: u.Bio(),
		CreatedAt: u.CreatedAt().Format("2006-01-02T15:04:05Z07:00"),
	}
	return dto
}
