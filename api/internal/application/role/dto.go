// Package role 提供 role 聚合的 application 层用例（CQRS）。
//
// 按统一完整 CQRS 范式：command（写）与 query（读）分离。
// - command/ : 创建/更新/删除角色、替换角色权限（改变状态）
// - query/   : 查询角色列表、角色详情、角色权限（只读）
//
// 用例层依赖领域接口（role.RoleRepository 等），不感知 GORM 等技术细节。
package role

// ============================================================
// DTO（Data Transfer Object）—— application 层入参/出参
// 与 interfaces 层的 HTTP DTO 分离（application DTO 不含 HTTP 语义）
// ============================================================

// RoleDTO 角色读模型（query 返回）
type RoleDTO struct {
	ID              int32    `json:"id"`
	Name            string   `json:"name"`
	Description     string   `json:"description"`
	IsBuiltin       bool     `json:"is_builtin"` // 是否内置角色（不可删/不可改名/不可改权限）
	PermissionCodes []string `json:"permission_codes"`
	CreatedAt       string   `json:"created_at"`
	UserCount       int64    `json:"user_count,omitempty"` // 仅列表查询时填充
}

// PermissionDTO 权限读模型（支持树形：menu 节点带 children）
type PermissionDTO struct {
	ID          int32           `json:"id"`
	Code        string          `json:"code"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Type        string          `json:"type"` // "menu" | "action"
	ParentID    *int32          `json:"parent_id"`
	Sort        int             `json:"sort"`
	IsBuiltin   bool            `json:"is_builtin"`
	Children    []PermissionDTO `json:"children,omitempty"` // 仅 menu 有
}

// RoleWithPermissionsDTO 角色含权限详情（GetRoleWithPermissions 返回）
type RoleWithPermissionsDTO struct {
	RoleDTO
	Permissions []PermissionDTO `json:"permissions"`
}
