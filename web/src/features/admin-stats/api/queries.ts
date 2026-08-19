import { keepPreviousData, useQuery } from "@tanstack/react-query";
import * as api from "./client";
import { statsKeys } from "./keys";

/**
 * 总览统计缓存时长（毫秒）。
 *
 * 聚合数字低频变化，1 分钟内重复进入概览页直接吃缓存，不做轮询。
 */
const STALE_TIME_MS = 60_000;

/** useDashboardStats - 后台总览统计 */
export const useDashboardStats = () =>
	useQuery({
		queryKey: statsKeys.dashboard(),
		queryFn: api.getDashboardStats,
		staleTime: STALE_TIME_MS,
	});

/**
 * useViewTrends - 浏览量趋势。
 *
 * @param days 日聚合窗口（7/30）；同档位请求跨组件共享同一缓存条目
 * @param enabled false 时挂起查询（未激活的档位不预取），默认 true
 */
export const useViewTrends = (days: number, enabled = true) =>
	useQuery({
		queryKey: statsKeys.views(days),
		queryFn: () => api.getViewTrends(days),
		staleTime: STALE_TIME_MS,
		enabled,
		// 切档时保留上一档数据渲染，避免整图闪骨架
		placeholderData: keepPreviousData,
	});
