import { apiGet } from "@shared/api/request";
import { useQuery } from "@tanstack/react-query";
import type { DashboardStats, ViewTrends } from "../model/types";
import { adminStatsKeys } from "./keys";

/**
 * fetchDashboardStats - 调后端 GET /admin/stats 拉取仪表盘总览统计
 *
 * httpClient 已自动 withCredentials + 解 envelope，此处直接拿到业务数据。
 *
 * @returns 总览统计，含最近文章与热门文章
 */
export const fetchDashboardStats = async (): Promise<DashboardStats> =>
	apiGet<DashboardStats>("/admin/stats");

/**
 * useDashboardStats - 仪表盘总览统计 hook
 *
 * 当前接口无查询参数，缓存 key 固定。
 */
export const useDashboardStats = () =>
	useQuery({
		queryKey: adminStatsKeys.dashboard(),
		queryFn: fetchDashboardStats,
	});

/**
 * fetchViewTrends - 调后端 GET /admin/stats/views 拉取浏览量趋势
 *
 * @returns 按日与按月聚合的浏览量序列
 */
export const fetchViewTrends = async (): Promise<ViewTrends> =>
	apiGet<ViewTrends>("/admin/stats/views");

/**
 * useViewTrends - 浏览量趋势 hook
 *
 * 当前接口无查询参数，缓存 key 固定。
 */
export const useViewTrends = () =>
	useQuery({
		queryKey: adminStatsKeys.views(),
		queryFn: fetchViewTrends,
	});
