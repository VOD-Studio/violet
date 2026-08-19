import { apiGet } from "@shared/api/request";
import type { DashboardStatsDTO, ViewTrendsDTO } from "../model/types";

export const getDashboardStats = () => apiGet<DashboardStatsDTO>("/admin/stats");

/**
 * 浏览量趋势。days 为日聚合窗口（白名单 7/30），非白名单值由后端回退 30。
 */
export const getViewTrends = (days: number) =>
	apiGet<ViewTrendsDTO>(`/admin/stats/views?days=${days}`);
