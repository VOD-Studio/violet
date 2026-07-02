// Package permission 定义权限点聚合的领域模型。
//
// 权限点是 RBAC 系统的最小授权单元，格式为 module:action（如 post:create）。
// 权限点本身不含业务逻辑，主要用于格式校验与生命周期管理（CRUD）。
// 权限点与角色的关联由 role 聚合管理（Role.Grant/Revoke）。
package permission

import (
	"regexp"
	"strings"

	"blog-api/internal/domain/shared"
)

// CodeMaxLength 权限代码最大长度
const CodeMaxLength = 50

// permissionCodePattern 权限代码格式：
// - menu 节点：纯 module 名，如 post、user
// - action 节点：module:action，如 post:create、comment:approve
//
// 注意：action 部分允许连字符以兼容既有权限点如 fetch-meta、manage-group、update-role。
// 用 \x{} 而非 \u 转义（Go regexp RE2 不支持 \u）。
var permissionCodePattern = regexp.MustCompile(`^[a-z]+(:[a-z][a-z-]*)?$`)

// ============================================================
// Code 值对象
// ============================================================

// Code 权限代码值对象
//
// 格式：module:action，如 post:create、comment:approve、admin:access
// 全小写，两段均至少 1 个字符，总长不超过 CodeMaxLength
type Code struct {
	value string
}

// ParseCode 解析并校验权限代码
func ParseCode(s string) (Code, error) {
	if len(s) > CodeMaxLength {
		return Code{}, shared.BadRequest("权限代码长度不能超过 50 字符")
	}
	if !permissionCodePattern.MatchString(s) {
		return Code{}, shared.BadRequest("权限代码格式无效，必须是 module:action 格式（如 post:create）")
	}
	return Code{value: s}, nil
}

// MustParse 解析权限代码，非法时 panic（仅用于常量定义）
func MustParse(s string) Code {
	c, err := ParseCode(s)
	if err != nil {
		panic(err)
	}
	return c
}

// String 返回权限代码字符串
func (c Code) String() string { return c.value }

// Equal 比较两个权限代码是否相同
func (c Code) Equal(other Code) bool { return c.value == other.value }

// IsMenu 是否为 menu 分组节点（不含冒号）
func (c Code) IsMenu() bool { return !strings.Contains(c.value, ":") }

// 预定义权限代码常量（与 migration 025_rbac 种子数据对应）
//
// 这些常量供中间件 RequirePermission、应用层校验等场景使用，
// 避免散落的字符串字面量。
var (
	PostCreate           = MustParse("post:create")
	PostUpdate           = MustParse("post:update")
	PostDelete           = MustParse("post:delete")
	PostPublish          = MustParse("post:publish")
	CommentDelete        = MustParse("comment:delete")
	CommentApprove       = MustParse("comment:approve")
	TagCreate            = MustParse("tag:create")
	TagUpdate            = MustParse("tag:update")
	TagDelete            = MustParse("tag:delete")
	MediaUpload          = MustParse("media:upload")
	MediaDelete          = MustParse("media:delete")
	PlaylistCreate       = MustParse("playlist:create")
	PlaylistUpdate       = MustParse("playlist:update")
	PlaylistDelete       = MustParse("playlist:delete")
	PlaylistToggle       = MustParse("playlist:toggle")
	SongUpload           = MustParse("song:upload")
	SongUpdate           = MustParse("song:update")
	SongDelete           = MustParse("song:delete")
	SongFetchMeta        = MustParse("song:fetch-meta")
	EmojiCreate          = MustParse("emoji:create")
	EmojiDelete          = MustParse("emoji:delete")
	EmojiManageGroup     = MustParse("emoji:manage-group")
	UserList             = MustParse("user:list")
	UserUpdateRole       = MustParse("user:update-role")
	UserBan              = MustParse("user:ban")
	UserAssignSuperAdmin = MustParse("user:assign-superadmin")
	ProjectCreate        = MustParse("project:create")
	ProjectUpdate        = MustParse("project:update")
	ProjectDelete        = MustParse("project:delete")
	SettingsView         = MustParse("settings:view")
	SettingsUpdate       = MustParse("settings:update")
	RoleManage           = MustParse("role:manage")
	AnnouncementManage   = MustParse("announcement:manage")
	AdminAccess          = MustParse("admin:access")
)

// ============================================================
// Permission 实体（非聚合根，作为 role 聚合的引用对象）
// ============================================================

// Permission 权限点实体
//
// 权限点本身是简单的数据载体，不维护复杂不变量。
// 它作为 role 聚合的引用对象存在（role_permissions 关联表），
// 也可独立 CRUD（管理员维护权限点定义）。
type Permission struct {
	// id 数据库 SERIAL
	id int32
	// code 权限代码（值对象）
	code Code
	// name 权限显示名称
	name string
	// description 权限描述
	description string
	// parentID 父权限 ID（action 指向所属 menu；menu 为 nil）
	parentID *int32
	// permType 权限类型："menu"（分组容器）| "action"（可授权操作）
	permType string
	// sort 排序值（升序）
	sort int
	// isBuiltin 是否内置权限（内置不可删、不可改 code）
	isBuiltin bool
}

// NewPermission 创建权限点
func NewPermission(id int32, code Code, name, description string, parentID *int32, permType string, sort int, isBuiltin bool) *Permission {
	return &Permission{
		id:          id,
		code:        code,
		name:        name,
		description: description,
		parentID:    parentID,
		permType:    permType,
		sort:        sort,
		isBuiltin:   isBuiltin,
	}
}

// ID 返回权限点 ID
func (p *Permission) ID() int32 { return p.id }

// Code 返回权限代码
func (p *Permission) Code() Code { return p.code }

// Name 返回权限名称
func (p *Permission) Name() string { return p.name }

// Description 返回权限描述
func (p *Permission) Description() string { return p.description }

// ParentID 返回父权限 ID（nil 表示顶层 menu）
func (p *Permission) ParentID() *int32 { return p.parentID }

// Type 返回权限类型（menu / action）
func (p *Permission) Type() string { return p.permType }

// Sort 返回排序值
func (p *Permission) Sort() int { return p.sort }

// IsBuiltin 返回是否内置权限
func (p *Permission) IsBuiltin() bool { return p.isBuiltin }

// UpdateName 更新权限显示名称（内置也可改）
func (p *Permission) UpdateName(name string) { p.name = name }

// UpdateDescription 更新权限描述（内置也可改）
func (p *Permission) UpdateDescription(desc string) { p.description = desc }

// UpdateParent 更新父节点（内置也可改）
func (p *Permission) UpdateParent(parentID *int32) { p.parentID = parentID }

// UpdateSort 更新排序（内置也可改）
func (p *Permission) UpdateSort(sort int) { p.sort = sort }

// UpdateCode 更新权限代码——内置权限禁止
func (p *Permission) UpdateCode(c Code) error {
	if p.isBuiltin {
		return ErrCannotModifyBuiltin
	}
	p.code = c
	return nil
}

// 领域错误（与 repository.go 的错误分开，放 entity 便于 command 层引用）
var (
	// ErrCannotModifyBuiltin 内置权限不可改 code 或删除
	ErrCannotModifyBuiltin = shared.BadRequest("内置权限不可修改代码或删除")
)
