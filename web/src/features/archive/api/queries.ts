import { useQuery } from "@tanstack/react-query";
import * as api from "./client";
import { archiveKeys } from "./keys";

/** useArchiveYears - 归档年份索引 hook（SSR 预取用） */
export const useArchiveYears = () =>
	useQuery({
		queryKey: archiveKeys.years(),
		queryFn: () => api.fetchArchiveYears(),
	});

/** useArchiveYear - 指定年份归档 hook（懒加载，enabled 控制是否请求） */
export const useArchiveYear = (year: number, enabled = true) =>
	useQuery({
		queryKey: archiveKeys.year(year),
		queryFn: () => api.fetchArchiveYear(year),
		enabled,
	});
