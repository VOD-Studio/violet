import type { PostBrowseFilter } from "@entities/post/model/types";
import { useQuery } from "@tanstack/react-query";
import * as api from "./client";
import { archiveKeys } from "./keys";

export const useArchiveYears = (filter: PostBrowseFilter = {}) =>
	useQuery({
		queryKey: archiveKeys.years(filter),
		queryFn: () => api.fetchArchiveYears(filter),
	});

/** 未激活的年份不发请求；筛选变化使用独立缓存。 */
export const useArchiveYear = (year: number, filter: PostBrowseFilter, enabled = true) =>
	useQuery({
		queryKey: archiveKeys.year(year, filter),
		queryFn: () => api.fetchArchiveYear(year, filter),
		enabled,
	});
