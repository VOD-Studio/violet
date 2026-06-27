/**
 * admin-permissions 模块类型定义
 */

/**
 * PermissionDTO - 权限数据传输对象
 *
 * 对应后端 GET /admin/permissions 返回的权限对象
 */
export interface PermissionDTO {
    /** 权限 ID */
    id?: number;
    /** 权限代码（如 user:list, admin:access） */
    code?: string;
    /** 权限名称 */
    name?: string;
    /** 权限描述 */
    description?: string;
}

/**
 * CreatePermissionRequest - 创建权限请求
 */
export interface CreatePermissionRequest {
    /** 权限代码 */
    code: string;
    /** 权限名称 */
    name: string;
    /** 权限描述 */
    description?: string;
}

/**
 * UpdatePermissionRequest - 更新权限请求
 */
export interface UpdatePermissionRequest {
    /** 权限名称 */
    name?: string;
    /** 权限描述 */
    description?: string;
}
