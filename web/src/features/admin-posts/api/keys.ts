import type { AdminPostListQuery } from "../model/types";

/** adminPostKeys - 后台文章 query key 工厂 */
export const adminPostKeys = {
	/** 模块根 */
	all: ["admin-posts"] as const,
	/** 列表维度 */
	lists: () => [...adminPostKeys.all, "list"] as const,
	/** 具体列表查询，按状态与分页 */
	list: (query: AdminPostListQuery) => [...adminPostKeys.lists(), query] as const,
	/** 详情维度 */
	details: () => [...adminPostKeys.all, "detail"] as const,
	/** 具体详情，按 ID */
	detail: (id: string) => [...adminPostKeys.details(), id] as const,
	/** 历史版本维度 */
	versions: (postId: string) => [...adminPostKeys.detail(postId), "versions"] as const,
	/** 具体历史版本，按版本 ID */
	version: (versionId: string) => ["admin-posts", "versions", versionId] as const,
};
