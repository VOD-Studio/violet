/**
 * adminStatsKeys - 仪表盘统计查询的 query key 工厂
 *
 * 集中管理 key 避免散落字符串导致缓存失效不彻底。
 * 子键按 dashboard/views 维度组织，便于按维度 invalidate。
 */
export const adminStatsKeys = {
	/** admin-stats 模块根 key */
	all: ["admin-stats"] as const,
	/** 仪表盘总览维度 */
	dashboard: () => [...adminStatsKeys.all, "dashboard"] as const,
	/** 浏览量趋势维度 */
	views: () => [...adminStatsKeys.all, "views"] as const,
};
