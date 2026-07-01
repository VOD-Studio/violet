/**
 * settingsKeys - 公开站点设置查询的 query key 工厂
 *
 * 后台管理 key 见 admin-settings、admin-announcements。
 */
export const settingsKeys = {
    /** settings 模块根 key */
    all: ["settings"] as const,
    /** 公开站点配置维度 */
    public: () => [...settingsKeys.all, "public"] as const,
    /** 公告维度 */
    announcements: () => [...settingsKeys.all, "announcements"] as const,
};
