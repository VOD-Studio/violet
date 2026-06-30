/** auditLogKeys - 操作日志 query key 工厂 */
export const auditLogKeys = {
    /** 模块根 */
    all: ["audit-logs"] as const,
    /** 列表维度 */
    lists: () => [...auditLogKeys.all, "list"] as const,
    /** 具体列表查询（按查询参数区分） */
    list: (query: { page?: number; limit?: number }) => [...auditLogKeys.lists(), query] as const,
    /** 指定用户列表维度 */
    userLists: () => [...auditLogKeys.all, "user-list"] as const,
    /** 指定用户列表查询 */
    userList: (userId: string, query: { page?: number; limit?: number }) =>
        [...auditLogKeys.userLists(), userId, query] as const,
};
