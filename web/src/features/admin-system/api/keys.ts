/** 监控模块 query key 工厂 */
export const systemKeys = {
    all: ["admin-system"] as const,
    snapshot: () => [...systemKeys.all, "snapshot"] as const,
    history: () => [...systemKeys.all, "history"] as const,
};
