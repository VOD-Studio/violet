import { apiGet } from "@shared/api/request";
import { queryOptions } from "@tanstack/react-query";
import type { GardenGrowth } from "../model/growth";

export const gardenGrowthQueryOptions = () =>
	queryOptions({
		queryKey: ["about", "growth"],
		queryFn: ({ signal }) =>
			apiGet<GardenGrowth>("/journal/growth", {
				signal,
				// 本地快照可进首屏 HTML，但不可用时不等通用 HTTP 超时。
				timeout: import.meta.env.SSR ? 450 : undefined,
			}),
		staleTime: 60_000,
		retry: import.meta.env.SSR ? false : 1,
	});
