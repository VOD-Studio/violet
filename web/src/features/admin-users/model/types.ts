/**
 * admin-users 模块类型定义
 *
 * 对接后端 /admin/users 系列接口
 */

/**
 * AdminUserDTO - 后台用户列表返回的用户对象
 *
 * 注意：字段名与后端 useradmin service 的 DTO 对应
 * avatar（非 avatar_url）是后端 useradmin 的字段名
 */
export interface AdminUserDTO {
    /** 用户 ID（UUID 字符串） */
    id: string;
    /** 用户名 */
    username: string;
    /** 邮箱 */
    email: string;
    /** 角色：user / admin / superadmin */
    role: "user" | "admin" | "superadmin";
    /** 邮箱是否已验证 */
    email_verified: boolean;
    /** 账户是否启用 */
    is_active: boolean;
    /** 个人简介 */
    bio: string;
    /** 头像 URL（注意：后端字段名是 avatar 而非 avatar_url） */
    avatar: string;
    /** 创建时间（RFC3339） */
    created_at: string;
}

/**
 * ListUsersRequest - 用户列表请求参数
 */
export interface ListUsersRequest {
    /** 页码，从 1 开始 */
    page: number;
    /** 每页数量 */
    limit: number;
    /** 角色筛选（可选） */
    role?: string;
    /** 状态筛选（可选） */
    is_active?: boolean;
    /** 关键词搜索（用户名/邮箱，可选） */
    keyword?: string;
}

/**
 * ListUsersResponse - 用户列表响应
 */
export interface ListUsersResponse {
    /** 用户列表 */
    data: AdminUserDTO[];
    /** 分页信息 */
    meta: {
        page: number;
        limit: number;
        total: number;
    };
}

/**
 * CreateUserRequest - 创建用户请求
 */
export interface CreateUserRequest {
    /** 用户名 */
    username: string;
    /** 邮箱 */
    email: string;
    /** 密码，至少 6 位 */
    password: string;
    /** 角色，缺省 user */
    role?: "user" | "admin" | "superadmin";
    /** 是否启用，缺省 true */
    is_active?: boolean;
}

/**
 * UpdateUserRequest - 更新用户请求（部分更新）
 */
export interface UpdateUserRequest {
    /** 用户名 */
    username?: string;
    /** 邮箱 */
    email?: string;
    /** 密码 */
    password?: string;
    /** 角色 */
    role?: "user" | "admin" | "superadmin";
    /** 是否启用 */
    is_active?: boolean;
}

/**
 * UpdateUserRoleRequest - 修改用户角色请求
 */
export interface UpdateUserRoleRequest {
    /** 角色 */
    role: "user" | "admin" | "superadmin";
}

/**
 * UpdateUserStatusRequest - 修改用户状态请求
 */
export interface UpdateUserStatusRequest {
    /** 是否启用 */
    is_active: boolean;
}

/**
 * BatchUpdateStatusRequest - 批量修改状态请求
 */
export interface BatchUpdateStatusRequest {
    /** 用户 ID 列表 */
    ids: string[];
    /** 是否启用 */
    is_active: boolean;
}

/**
 * BatchUpdateRoleRequest - 批量修改角色请求
 */
export interface BatchUpdateRoleRequest {
    /** 用户 ID 列表 */
    ids: string[];
    /** 角色 */
    role: "user" | "admin" | "superadmin";
}

/**
 * BatchUpdateResponse - 批量操作响应
 */
export interface BatchUpdateResponse {
    /** 受影响的记录数 */
    affected: number;
}
