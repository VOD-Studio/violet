import type { PostBrowseFilter } from "@entities/post/model/types";
import type { PostListQuery } from "../model/types";

export const postKeys = {
	/** 文章模块根 key */
	all: ["posts"] as const,
	/** 文章列表维度 */
	lists: () => [...postKeys.all, "list"] as const,
	/** 具体列表查询 */
	list: (query: PostListQuery) => [...postKeys.lists(), query] as const,
	tags: (filter: Pick<PostBrowseFilter, "source">) => [...postKeys.all, "tags", filter] as const,
	/** 文章详情维度 */
	details: () => [...postKeys.all, "detail"] as const,
	/** 具体文章详情 */
	detail: (slug: string) => [...postKeys.details(), slug] as const,
	/** 搜索维度 */
	search: (query: string) => [...postKeys.all, "search", query] as const,
};
