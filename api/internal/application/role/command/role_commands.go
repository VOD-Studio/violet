// Package command 提供 role 聚合的写操作用例（CQRS Command 侧）。
package command

import (
	"context"

	"github.com/rs/zerolog/log"

	appshared "blog-api/internal/application/shared"
	"blog-api/internal/domain/permission"
	"blog-api/internal/domain/role"
	"blog-api/internal/domain/shared"
)

// ============================================================
// CreateRole 创建角色
// ============================================================

// CreateRoleInput 创建角色入参
type CreateRoleInput struct {
	Name        string
	Description string
}

// CreateRoleOutput 创建角色出参
type CreateRoleOutput struct {
	ID int32
}

// CreateRoleHandler 创建角色用例
//
// 编排：
// 1. 校验角色名格式（值对象）
// 2. 查重（名称全局唯一）
// 3. 调用 NewRole 工厂（记录 RoleCreated 事件）
// 4. 持久化
// 5. 发布事件
type CreateRoleHandler struct {
	roleRepo role.RoleRepository
	bus      appshared.EventBus
}

// NewCreateRoleHandler 构造创建角色用例
func NewCreateRoleHandler(repo role.RoleRepository, bus appshared.EventBus) *CreateRoleHandler {
	return &CreateRoleHandler{roleRepo: repo, bus: bus}
}

// Handle 执行创建角色
func (h *CreateRoleHandler) Handle(ctx context.Context, in CreateRoleInput) (CreateRoleOutput, error) {
	// 1. 值对象校验
	name, err := role.ParseRoleName(in.Name)
	if err != nil {
		return CreateRoleOutput{}, err
	}

	// 2. 名称查重
	exists, err := h.roleRepo.ExistsByName(ctx, name)
	if err != nil {
		return CreateRoleOutput{}, err
	}
	if exists {
		return CreateRoleOutput{}, role.ErrNameExists
	}

	// 3. 工厂创建聚合
	rl := role.NewRole(0, name, in.Description)

	// 4. 持久化
	id, err := h.roleRepo.Save(ctx, rl)
	if err != nil {
		return CreateRoleOutput{}, err
	}

	// 5. 回填自增 ID（Save 生成），手动构造创建事件发布。
	//    聚合根不在 NewRole 里 RecordEvent（Save 前 ID 未知，占位 0 无意义）
	rl.SetRoleID(id)
	if err := h.bus.Publish(ctx, []shared.DomainEvent{role.NewRoleCreated(id, name)}); err != nil {
		log.Warn().Err(err).Msg("发布角色创建事件失败")
	}

	return CreateRoleOutput{ID: id}, nil
}

// ============================================================
// UpdateRole 更新角色基本信息
// ============================================================

// UpdateRoleInput 更新角色入参
type UpdateRoleInput struct {
	ID          int32
	Name        string
	Description string
}

// UpdateRoleHandler 更新角色用例
//
// 内置角色禁止改名（由领域层守卫）。
type UpdateRoleHandler struct {
	roleRepo role.RoleRepository
	bus      appshared.EventBus
}

// NewUpdateRoleHandler 构造更新角色用例
func NewUpdateRoleHandler(repo role.RoleRepository, bus appshared.EventBus) *UpdateRoleHandler {
	return &UpdateRoleHandler{roleRepo: repo, bus: bus}
}

// Handle 执行更新角色
func (h *UpdateRoleHandler) Handle(ctx context.Context, in UpdateRoleInput) error {
	// 1. 加载现有角色
	rl, err := h.roleRepo.FindByID(ctx, in.ID)
	if err != nil {
		return err
	}

	// 2. 重命名（内置角色守卫）
	if in.Name != "" && in.Name != rl.Name().String() {
		newName, err := role.ParseRoleName(in.Name)
		if err != nil {
			return err
		}
		// 名称变更需查重（排除自身）
		exists, err := h.roleRepo.ExistsByName(ctx, newName)
		if err != nil {
			return err
		}
		if exists {
			return role.ErrNameExists
		}
		if err := rl.Rename(newName); err != nil {
			return err
		}
	}

	// 3. 更新描述（内置角色守卫：UpdateDescription 现在返回 error）
	if in.Description != "" {
		if err := rl.UpdateDescription(in.Description); err != nil {
			return err
		}
	}

	// 4. 持久化
	if _, err := h.roleRepo.Save(ctx, rl); err != nil {
		return err
	}
	// 5. 发布聚合根事件（RoleUpdated，审计订阅者消费）
	if events := rl.PullEvents(); len(events) > 0 {
		if err := h.bus.Publish(ctx, events); err != nil {
			log.Warn().Err(err).Msg("发布角色更新事件失败")
		}
	}
	return nil
}

// ============================================================
// DeleteRole 删除角色
// ============================================================

// DeleteRoleInput 删除角色入参
type DeleteRoleInput struct {
	ID int32
}

// DeleteRoleHandler 删除角色用例
//
// 业务规则：
//   - 内置角色不可删除（领域层 CanDelete 守卫）
//   - 正在被用户使用的角色不可删除（CountUsers 检查）
type DeleteRoleHandler struct {
	roleRepo role.RoleRepository
	bus      appshared.EventBus
}

// NewDeleteRoleHandler 构造删除角色用例
func NewDeleteRoleHandler(repo role.RoleRepository, bus appshared.EventBus) *DeleteRoleHandler {
	return &DeleteRoleHandler{roleRepo: repo, bus: bus}
}

// Handle 执行删除角色
func (h *DeleteRoleHandler) Handle(ctx context.Context, in DeleteRoleInput) error {
	// 1. 加载角色
	rl, err := h.roleRepo.FindByID(ctx, in.ID)
	if err != nil {
		return err
	}

	// 2. 内置角色守卫
	if !rl.CanDelete() {
		return role.ErrCannotModifyBuiltin
	}

	// 3. 使用中检查
	count, err := h.roleRepo.CountUsers(ctx, in.ID)
	if err != nil {
		return err
	}
	if count > 0 {
		return role.ErrInUse
	}

	// 4. 删除
	if err := h.roleRepo.Delete(ctx, in.ID); err != nil {
		return err
	}
	// 5. 发布角色删除事件（聚合根不可继续存在，手动构造）
	if err := h.bus.Publish(ctx, []shared.DomainEvent{role.NewRoleDeleted(in.ID, rl.Name().String())}); err != nil {
		log.Warn().Err(err).Msg("发布角色删除事件失败")
	}
	return nil
}

// ============================================================
// ReplaceRolePermissions 替换角色权限
// ============================================================

// ReplaceRolePermissionsInput 替换角色权限入参
type ReplaceRolePermissionsInput struct {
	RoleID          int32
	PermissionCodes []string
}

// ReplaceRolePermissionsHandler 替换角色权限用例
//
// 编排：
// 1. 加载角色（确保存在）
// 2. 校验权限代码格式合法性
// 3. 调用聚合 ReplacePermissions（记录 RolePermissionsChanged 事件）
// 4. 持久化权限关联
// 5. 发布事件（触发权限缓存重载）
type ReplaceRolePermissionsHandler struct {
	roleRepo role.RoleRepository
	bus      appshared.EventBus
}

// NewReplaceRolePermissionsHandler 构造替换角色权限用例
func NewReplaceRolePermissionsHandler(repo role.RoleRepository, bus appshared.EventBus) *ReplaceRolePermissionsHandler {
	return &ReplaceRolePermissionsHandler{roleRepo: repo, bus: bus}
}

// Handle 执行替换角色权限
func (h *ReplaceRolePermissionsHandler) Handle(ctx context.Context, in ReplaceRolePermissionsInput) error {
	// 1. 加载角色
	rl, err := h.roleRepo.FindByID(ctx, in.RoleID)
	if err != nil {
		return err
	}

	// 2. 校验所有权限代码格式合法性
	for _, code := range in.PermissionCodes {
		if _, err := permission.ParseCode(code); err != nil {
			return err
		}
	}

	// 3. 聚合方法（内置角色守卫 + 记录事件）
	if err := rl.ReplacePermissions(in.PermissionCodes); err != nil {
		return err
	}

	// 4. 持久化权限关联
	if err := h.roleRepo.SavePermissions(ctx, in.RoleID, in.PermissionCodes); err != nil {
		return err
	}

	// 5. 发布事件（订阅者重载权限缓存）
	if events := rl.PullEvents(); len(events) > 0 {
		_ = h.bus.Publish(ctx, events)
	}

	return nil
}
