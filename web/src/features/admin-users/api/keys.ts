/**
 * adminUsersKeys - admin-users 模块 query key 工厂
 *
 * 集中管理 query keys，避免缓存失效不彻底
 */
export const adminUsersKeys = {
    /** admin-users 模块根 key */
    all: ["admin", "users"] as const,

    /** 用户列表维度 */
    lists: () => [...adminUsersKeys.all, "list"] as const,

    /** 特定筛选条件的用户列表 */
    list: (filters: {
        page: number;
        limit: number;
        role?: string;
        is_active?: boolean;
        keyword?: string;
    }) => [...adminUsersKeys.lists(), filters] as const,

    /** 用户详情维度 */
    details: () => [...adminUsersKeys.all, "detail"] as const,

    /** 特定用户详情 */
    detail: (id: string) => [...adminUsersKeys.details(), id] as const,
};
