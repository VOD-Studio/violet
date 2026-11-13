import type { SeriesListQuery } from "../model/types";

export const seriesKeys = {
	all: ["series"] as const,
	lists: () => [...seriesKeys.all, "list"] as const,
	list: (query: SeriesListQuery) => [...seriesKeys.lists(), query] as const,
	details: () => [...seriesKeys.all, "detail"] as const,
	detail: (slug: string) => [...seriesKeys.details(), slug] as const,
	contexts: () => [...seriesKeys.all, "context"] as const,
	context: (postSlug: string) => [...seriesKeys.contexts(), postSlug] as const,
};
