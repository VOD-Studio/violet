import type { PostBrowseFilter } from "@entities/post/model/types";

export const archiveKeys = {
	all: ["archive"] as const,
	years: (filter: PostBrowseFilter = {}) => [...archiveKeys.all, "years", filter] as const,
	year: (year: number, filter: PostBrowseFilter = {}) =>
		[...archiveKeys.all, "year", year, filter] as const,
};
