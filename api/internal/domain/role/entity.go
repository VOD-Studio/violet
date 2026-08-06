// Package role 定义角色聚合的领域模型。
//
// 角色聚合是 RBAC 权限系统的核心：用户通过角色关联获得权限点。
// 本包定义 Role 聚合根、内置角色常量、领域事件与仓储端口。
package role

import (
	"regexp"
	"time"

	"blog-api/internal/domain/shared"
)

// ============================================================
// 内置角色（系统预置，不可删除）
// ============================================================

// BuiltinRoles 内置角色集合，这些角色禁止删除或改名
//
// 内置角色：user / author / admin / superadmin。
// editor 已在迁移 050 重命名为 author。
var BuiltinRoles = map[string]bool{
	"user":       true,
	"author":     true,
	"admin":      true,
	"superadmin": true,
}

// SuperadminRole superadmin 角色名。
//
// 拥有全部权限且为固有语义，不依赖 role_permissions 表，新增权限点自动拥有。
const SuperadminRole = "superadmin"

// WildcardPermission 通配权限码，超管角色返回此码而非枚举全部权限点。
const WildcardPermission = "*"

// IsBuiltin 判断角色名是否为内置角色
func IsBuiltin(name string) bool { return BuiltinRoles[name] }

// ============================================================
// RoleName 值对象
// ============================================================

var roleNamePattern = regexp.MustCompile(`^[a-z0-9_-]{2,50}$`)

// RoleName 角色名值对象
//
// 校验规则：2-50 字符，仅小写字母、数字、下划线、连字符
type RoleName struct {
	// value 角色名原始字符串,经 ParseRoleName 校验(2-50 字符,小写字母/数字/下划线/连字符)后封装
	value string
}

// ParseRoleName 解析并校验角色名
func ParseRoleName(s string) (RoleName, error) {
	if !roleNamePattern.MatchString(s) {
		return RoleName{}, shared.BadRequest("角色名须为 2-50 位小写字母、数字、下划线或连字符")
	}
	return RoleName{value: s}, nil
}

// String 返回角色名字符串
func (n RoleName) String() string { return n.value }

// IsBuiltin 是否为内置角色
func (n RoleName) IsBuiltin() bool { return IsBuiltin(n.value) }

// Equal 比较两个角色名是否相同
func (n RoleName) Equal(other RoleName) bool { return n.value == other.value }

// ============================================================
// 领域事件
// ============================================================

// RolePermissionsChanged 角色权限已变更事件
//
// 触发场景：管理员调整角色拥有的权限点后。
// 订阅者：application/permission.Checker（重载权限缓存）+ 审计服务。
// Added/Removed 为权限点增删列表（审计 before/after）。
type RolePermissionsChanged struct {
	shared.BaseEvent
	// RoleID 变更权限的角色 ID
	RoleID int32
	// Added 新增的权限点
	Added []string
	// Removed 移除的权限点
	Removed []string
}

// NewRolePermissionsChanged 构造角色权限变更事件
func NewRolePermissionsChanged(roleID int32, added, removed []string) RolePermissionsChanged {
	// 角色用 int32 ID，聚合根 ID 用占位（角色聚合与 user 聚合 ID 体系不同）
	return RolePermissionsChanged{
		BaseEvent: shared.NewBaseEvent("role.permissions_changed", shared.ID{}),
		RoleID:    roleID,
		Added:     added,
		Removed:   removed,
	}
}

// RoleCreated 角色已创建事件
type RoleCreated struct {
	shared.BaseEvent
	// roleID 角色 ID
	RoleID int32
	// roleName 角色名(值对象)
	RoleName RoleName
}

// NewRoleCreated 构造角色创建事件
func NewRoleCreated(roleID int32, name RoleName) RoleCreated {
	return RoleCreated{
		BaseEvent: shared.NewBaseEvent("role.created", shared.ID{}),
		RoleID:    roleID,
		RoleName:  name,
	}
}

// RoleUpdated 角色已更新事件（重命名/改描述）
//
// FromName/ToName 为变更前后角色名（审计 before/after 字段，未改名时相同）。
type RoleUpdated struct {
	shared.BaseEvent
	// RoleID 角色 ID
	RoleID int32
	// FromName 变更前角色名
	FromName string
	// ToName 变更后角色名
	ToName string
}

// NewRoleUpdated 构造角色更新事件
func NewRoleUpdated(roleID int32, fromName, toName string) RoleUpdated {
	return RoleUpdated{
		BaseEvent: shared.NewBaseEvent("role.updated", shared.ID{}),
		RoleID:    roleID,
		FromName:  fromName,
		ToName:    toName,
	}
}

// RoleDeleted 角色已删除事件
//
// 删除后聚合根不可继续存在，事件由应用层手动构造发布。
type RoleDeleted struct {
	shared.BaseEvent
	// RoleID 角色 ID
	RoleID int32
	// RoleName 删除前角色名
	RoleName string
}

// NewRoleDeleted 构造角色删除事件
func NewRoleDeleted(roleID int32, name string) RoleDeleted {
	return RoleDeleted{
		BaseEvent: shared.NewBaseEvent("role.deleted", shared.ID{}),
		RoleID:    roleID,
		RoleName:  name,
	}
}

// ============================================================
// Role 聚合根
// ============================================================

// Role 角色聚合根
//
// 角色聚合的不变量：
//   - 名称全局唯一（由 repository 保证）
//   - 内置角色（user/author/admin/superadmin）禁止改名和删除
//   - 正在被用户使用的角色禁止删除
//   - 权限点通过 Grant/Revoke 方法增减，保证 role_permissions 一致性
type Role struct {
	shared.AggregateRoot

	// roleID 角色 ID（数据库 SERIAL，区别于聚合根的 UUID ID）
	roleID int32
	// name 角色名（值对象）
	name RoleName
	// description 角色描述
	description string
	// permissions 该角色拥有的权限代码集合
	permissions map[string]struct{}
	// timestamps 审计时间戳
	timestamps shared.Timestamps
}

// NewRole 创建新角色（非内置）
func NewRole(id int32, name RoleName, description string) *Role {
	r := &Role{
		roleID:      id,
		name:        name,
		description: description,
		permissions: make(map[string]struct{}),
	}
	// 不在此 RecordEvent：创建事件由应用层发布（RoleCreated 需真实自增 ID，
	// 而 Save 前 ID 未知——聚合根里记录只能是占位 0）
	return r
}

// ReconstructRole 从持久化数据重建角色聚合
func ReconstructRole(
	id int32,
	name RoleName,
	description string,
	permissionCodes []string,
	createdAt time.Time,
	updatedAt time.Time,
) *Role {
	perms := make(map[string]struct{}, len(permissionCodes))
	for _, code := range permissionCodes {
		perms[code] = struct{}{}
	}
	r := &Role{
		roleID:      id,
		name:        name,
		description: description,
		permissions: perms,
		timestamps: shared.Timestamps{
			CreatedAt: createdAt,
			UpdatedAt: updatedAt,
		},
	}
	return r
}

// ============================================================
// 业务方法
// ============================================================

// Rename 重命名角色
//
// 业务规则：内置角色禁止改名。
func (r *Role) Rename(newName RoleName) error {
	if r.name.IsBuiltin() {
		return shared.Forbidden("不能修改内置角色的名称")
	}
	old := r.name.String()
	r.name = newName
	r.RecordEvent(NewRoleUpdated(r.roleID, old, newName.String()))
	return nil
}

// UpdateDescription 更新角色描述
//
// 允许修改任意角色（含内置角色）的描述：角色管理接口已由 SuperAdminRequired
// 中间件保护，只有内置超管能调用，无需在领域层再设硬限制。
func (r *Role) UpdateDescription(desc string) error {
	r.description = desc
	return nil
}

// Grant 授予角色一个权限点
//
// 幂等：重复授予同一权限不会重复记录。
func (r *Role) Grant(permissionCode string) {
	if r.permissions == nil {
		r.permissions = make(map[string]struct{})
	}
	r.permissions[permissionCode] = struct{}{}
}

// Revoke 撤销角色一个权限点
//
// 幂等：撤销未拥有的权限不会报错。
func (r *Role) Revoke(permissionCode string) {
	delete(r.permissions, permissionCode)
}

// ReplacePermissions 用新的权限集合完全替换当前权限
//
// 允许替换任意角色的权限：角色管理接口已由 SuperAdminRequired
// 中间件保护，只有 root 能调用。superadmin 角色的拒改守卫在 application 层
// （ReplaceRolePermissionsHandler），domain 方法本身不做角色区分。
// 记录 RolePermissionsChanged 事件。
func (r *Role) ReplacePermissions(codes []string) error {
	// 对比新旧权限集，收集增删（审计 before/after）
	newSet := make(map[string]struct{}, len(codes))
	for _, code := range codes {
		newSet[code] = struct{}{}
	}
	added := make([]string, 0, len(codes))
	removed := make([]string, 0, len(r.permissions))
	for code := range newSet {
		if _, ok := r.permissions[code]; !ok {
			added = append(added, code)
		}
	}
	for code := range r.permissions {
		if _, ok := newSet[code]; !ok {
			removed = append(removed, code)
		}
	}
	r.permissions = newSet
	r.RecordEvent(NewRolePermissionsChanged(r.roleID, added, removed))
	return nil
}

// HasPermission 角色是否拥有指定权限点
func (r *Role) HasPermission(code string) bool {
	_, ok := r.permissions[code]
	return ok
}

// PermissionCodes 返回角色拥有的所有权限代码（副本，避免外部修改）
func (r *Role) PermissionCodes() []string {
	codes := make([]string, 0, len(r.permissions))
	for code := range r.permissions {
		codes = append(codes, code)
	}
	return codes
}

// CanDelete 角色是否可被删除
//
// 业务规则：内置角色不可删除。
func (r *Role) CanDelete() bool {
	return !r.name.IsBuiltin()
}

// ============================================================
// 访问器
// ============================================================

// SetRoleID 回填角色 ID（仅创建持久化后调用：Save 生成自增 ID，事件发布前必须回填）
func (r *Role) SetRoleID(id int32) { r.roleID = id }

func (r *Role) RoleID() int32        { return r.roleID }
func (r *Role) Name() RoleName       { return r.name }
func (r *Role) Description() string  { return r.description }
func (r *Role) CreatedAt() time.Time { return r.timestamps.CreatedAt }
func (r *Role) UpdatedAt() time.Time { return r.timestamps.UpdatedAt }
