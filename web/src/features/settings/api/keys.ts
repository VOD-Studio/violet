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
	/** 管理员站点设置维度 */
	admin: () => [...settingsKeys.all, "admin"] as const,
	/** 管理员公告列表维度 */
	adminAnnouncements: () => [...settingsKeys.all, "admin-announcements"] as const,
	/** 管理员公告详情维度 */
	adminAnnouncementDetail: (id: number) =>
		[...settingsKeys.all, "admin-announcements", id] as const,
};
