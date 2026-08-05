import { apiGet } from "@shared/api/request";
import { useQuery } from "@tanstack/react-query";

/** 公开只读统计 */
export interface PublicStats {
	posts_count: number;
	total_words: number;
	comments_count: number;
	uptime_days: number;
}

/** aboutKeys - 关于页数据查询的 query key 工厂 */
export const aboutKeys = {
	all: ["about"] as const,
	stats: () => [...aboutKeys.all, "stats"] as const,
};

/** fetchPublicStats - 调 GET /api/v1/stats 获取公开统计 */
export const fetchPublicStats = async (): Promise<PublicStats> => apiGet<PublicStats>("/stats");

/** usePublicStats - 站点生命体征统计 hook（staleTime 10 分钟） */
export const usePublicStats = () =>
	useQuery({
		queryKey: aboutKeys.stats(),
		queryFn: fetchPublicStats,
		staleTime: 10 * 60 * 1000,
	});
