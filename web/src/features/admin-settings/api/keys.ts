/** settingsKeys - 站点设置 query key 工厂 */
export const settingsKeys = {
    /** 模块根 */
    all: ["settings"] as const,
    /** 站点配置详情 */
    detail: () => [...settingsKeys.all, "detail"] as const,
};
