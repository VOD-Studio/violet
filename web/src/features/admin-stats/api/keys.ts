export const statsKeys = {
	/** 模块根 */
	all: ["admin-stats"] as const,
	/** 总览统计 */
	dashboard: () => [...statsKeys.all, "dashboard"] as const,
	/** 浏览趋势；days 进 key，7/30 档各自缓存 */
	views: (days: number) => [...statsKeys.all, "views", days] as const,
};
