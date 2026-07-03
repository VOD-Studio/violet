/** systemKeys - 服务监控 query key 工厂 */
export const systemKeys = {
    /** 模块根 */
    all: ["admin-system"] as const,
    /** 实时快照维度 */
    snapshot: () => [...systemKeys.all, "snapshot"] as const,
    /** 历史趋势维度 */
    history: () => [...systemKeys.all, "history"] as const,
};
