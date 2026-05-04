// 仪表盘统计 API Hooks
// 使用 react-query 管理仪表盘统计数据的 API 调用

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { dashboardKeys } from "./queryKeys";
import type { AdminStats, ViewTrends } from "./types";

/**
 * 获取后台统计数据
 */
export function useAdminStats() {
  return useQuery({
    queryKey: dashboardKeys.stats(),
    queryFn: () => api.get<AdminStats>("/admin/stats"),
  });
}

/**
 * 获取浏览量趋势数据
 */
export function useViewTrends() {
  return useQuery({
    queryKey: dashboardKeys.views(),
    queryFn: () => api.get<ViewTrends>("/admin/stats/views"),
  });
}
