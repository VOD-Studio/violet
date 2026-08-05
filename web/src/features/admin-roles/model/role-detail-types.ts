/**
 * admin-roles 扩展类型定义
 */

/**
 * RoleWithPermissionsDTO - 角色详情（含权限列表）
 *
 * 对应后端 GET /admin/roles/{id} 返回的角色详情对象
 */
export interface RoleWithPermissionsDTO {
	/** 角色 ID */
	id: number;
	/** 角色名称 */
	name: string;
	/** 角色描述 */
	description: string;
	/** 创建时间（RFC3339 格式） */
	created_at: string;
	/** 用户数量 */
	user_count: number;
	/** 权限代码列表 */
	permission_codes: string[];
	/** 权限详情列表 */
	permissions: PermissionDetail[];
}

/**
 * PermissionDetail - 权限详情
 */
export interface PermissionDetail {
	/** 权限 ID */
	id: number;
	/** 权限代码 */
	code: string;
	/** 权限名称 */
	name: string;
	/** 权限描述 */
	description: string;
}

/**
 * CreateRoleRequest - 创建角色请求
 */
export interface CreateRoleRequest {
	/** 角色名称 */
	name: string;
	/** 角色描述 */
	description: string;
}

/**
 * UpdateRoleRequest - 更新角色请求
 */
export interface UpdateRoleRequest {
	/** 角色名称 */
	name?: string;
	/** 角色描述 */
	description?: string;
}

/**
 * UpdateRolePermissionsRequest - 设置角色权限请求
 */
export interface UpdateRolePermissionsRequest {
	/** 权限代码列表 */
	permission_codes: string[];
}
