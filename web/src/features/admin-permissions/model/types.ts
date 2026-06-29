/**
 * admin-permissions 模块类型定义
 */

/** 权限类型：menu 为分组容器，action 为可授权操作 */
export type PermissionType = "menu" | "action";

/**
 * PermissionDTO - 权限数据传输对象（支持树形）
 *
 * 对应后端 GET /admin/permissions 返回的权限对象（已聚合为 menu→action 两层树）
 */
export interface PermissionDTO {
    /** 权限 ID */
    id?: number;
    /** 权限代码（menu 为纯 module 名如 post；action 为 module:action 如 post:create） */
    code?: string;
    /** 权限显示名称 */
    name?: string;
    /** 权限描述 */
    description?: string;
    /** 权限类型：menu（分组容器）| action（可授权操作） */
    type?: PermissionType;
    /** 父权限 ID（action 指向所属 menu；menu 为 null） */
    parent_id?: number | null;
    /** 排序值（升序） */
    sort?: number;
    /** 是否内置权限（内置不可删、不可改 code） */
    is_builtin?: boolean;
    /** 子权限列表（仅 menu 节点有，为其下 action） */
    children?: PermissionDTO[];
}

/**
 * CreatePermissionRequest - 创建权限请求
 */
export interface CreatePermissionRequest {
    /** 权限代码（必填） */
    code: string;
    /** 权限名称（必填） */
    name: string;
    /** 权限描述 */
    description?: string;
    /** 权限类型，默认 action */
    type?: PermissionType;
    /** 父权限 ID（action 必填指向 menu；menu 为 null） */
    parent_id?: number | null;
    /** 排序值，默认 0 */
    sort?: number;
}

/**
 * UpdatePermissionRequest - 更新权限请求
 */
export interface UpdatePermissionRequest {
    /** 权限代码（内置权限不可改，提交时后端忽略） */
    code?: string;
    /** 权限名称 */
    name?: string;
    /** 权限描述 */
    description?: string;
    /** 父权限 ID */
    parent_id?: number | null;
    /** 排序值 */
    sort?: number;
}
