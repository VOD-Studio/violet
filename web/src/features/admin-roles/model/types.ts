/**
 * admin-roles 模块类型定义
 */

/**
 * RoleDTO - 角色数据传输对象
 *
 * 对应后端 GET /admin/roles 返回的角色对象
 */
export interface RoleDTO {
    /** 角色 ID */
    id?: number;
    /** 角色名称（如 admin, editor, user, superadmin） */
    name?: string;
    /** 角色描述（如 "管理员"、"编辑"） */
    description?: string;
    /** 是否内置角色（user/author/admin/superadmin，不可重命名、不可删除，可改描述与权限分配） */
    is_builtin?: boolean;
    /** 权限代码列表 */
    permission_codes?: string[];
    /** 用户数量（仅列表查询时填充） */
    user_count?: number;
    /** 创建时间（RFC3339 格式） */
    created_at?: string;
}

/**
 * ListRolesResponse - 角色列表响应
 *
 * GET /admin/roles 的响应结构
 */
export interface ListRolesResponse {
    /** 角色列表 */
    data: RoleDTO[];
}
