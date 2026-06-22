/**
 * settingsKeys - 站点设置查询的 query key 工厂
 */
export const settingsKeys = {
	/** settings 模块根 key */
	all: ["settings"] as const,
	/** 公开站点配置维度 */
	public: () => [...settingsKeys.all, "public"] as const,
	/** 公告维度 */
	announcements: () => [...settingsKeys.all, "announcements"] as const,
};
