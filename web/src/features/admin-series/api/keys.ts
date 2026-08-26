import type { AdminSeriesListQuery } from "../model/types";

export const adminSeriesKeys = {
	all: ["admin-series"] as const,
	lists: () => [...adminSeriesKeys.all, "list"] as const,
	list: (query: AdminSeriesListQuery) => [...adminSeriesKeys.lists(), query] as const,
	details: () => [...adminSeriesKeys.all, "detail"] as const,
	detail: (id: string) => [...adminSeriesKeys.details(), id] as const,
};
