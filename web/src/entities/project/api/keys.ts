import type { PageQuery } from "@shared/api/types";

/** 项目缓存按列表、详情分组；后台项目变更按根键失效。 */
export const projectKeys = {
	all: ["projects"] as const,
	lists: () => [...projectKeys.all, "list"] as const,
	list: (query: PageQuery) => [...projectKeys.lists(), query] as const,
	details: () => [...projectKeys.all, "detail"] as const,
	detail: (id: string) => [...projectKeys.details(), id] as const,
};
