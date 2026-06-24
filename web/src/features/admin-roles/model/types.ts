/**
 * admin-roles 模块类型定义
 *
 * 对接后端 GET/POST/PATCH/DELETE /admin/roles 与 /admin/permissions。
 *
 * 字段命名说明：role/permission handler 经 application 层 DTO 序列化，
 * DTO 均打了 json tag，故前端字段为 snake_case，与 audit log 的 PascalCase 不同。
 * 对应后端 application/role/dto.go 的 RoleDTO / PermissionDTO / RoleWithPermissionsDTO。
 */

/**
 * Role - 角色读模型
 *
 * 对应后端 RoleDTO，列表与详情共用。UserCount 仅列表查询填充。
 */
export interface Role {
	/** 角色 ID */
	id: number;
	/** 角色名称 */
	name: string;
	/** 角色描述 */
	description: string;
	/** 角色拥有的权限 code 列表 */
	permission_codes: string[];
	/** 创建时间，RFC3339 字符串 */
	created_at: string;
	/** 拥有该角色的用户数，仅列表查询填充 */
	user_count?: number;
}

/**
 * Permission - 权限读模型
 *
 * 对应后端 PermissionDTO。
 */
export interface Permission {
	/** 权限 ID */
	id: number;
	/** 权限 code，唯一标识，如 post:admin */
	code: string;
	/** 权限名称 */
	name: string;
	/** 权限描述 */
	description: string;
}

/**
 * RoleWithPermissions - 角色详情含权限点
 *
 * 对应后端 RoleWithPermissionsDTO，继承 Role 字段并展开 permissions 数组。
 */
export interface RoleWithPermissions extends Role {
	/** 该角色拥有的权限点完整定义 */
	permissions: Permission[];
}

/**
 * CreateRole - 创建角色请求体
 *
 * 对接 POST /admin/roles，后端要求 name 长度 2-50。
 */
export interface CreateRole {
	/** 角色名称，必填，2-50 字符 */
	name: string;
	/** 角色描述，可空 */
	description?: string;
}

/**
 * UpdateRole - 更新角色请求体
 *
 * 对接 PATCH /admin/roles/{id}，name 留空表示不改。
 */
export interface UpdateRole {
	/** 角色名称，可空 */
	name?: string;
	/** 角色描述，可空 */
	description?: string;
}

/**
 * UpdateRolePermissions - 设置角色权限请求体
 *
 * 对接 PATCH /admin/roles/{id}/permissions，整体替换该角色的权限集合。
 */
export interface UpdateRolePermissions {
	/** 权限 code 列表，整体替换 */
	permission_codes: string[];
}

/**
 * CreatePermission - 创建权限请求体
 *
 * 对接 POST /admin/permissions，仅超级管理员可调用。
 */
export interface CreatePermission {
	/** 权限 code，必填，唯一标识 */
	code: string;
	/** 权限名称，必填 */
	name: string;
	/** 权限描述，可空 */
	description?: string;
}

/**
 * UpdatePermission - 更新权限请求体
 *
 * 对接 PATCH /admin/permissions/{code}，path param 为 code 而非数字 id。
 */
export interface UpdatePermission {
	/** 权限名称，必填 */
	name: string;
	/** 权限描述，可空 */
	description?: string;
}
