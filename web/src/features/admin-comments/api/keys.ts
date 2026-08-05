import type { CommentListQuery } from "../model/types";

/** commentKeys - 评论 query key 工厂 */
export const commentKeys = {
	/** 模块根 */
	all: ["comments"] as const,
	/** 全部列表维度（按状态 + anchor 维度） */
	lists: () => [...commentKeys.all, "list"] as const,
	/** 具体列表查询（按状态 + anchor + 分页） */
	list: (query: CommentListQuery) => [...commentKeys.lists(), query] as const,
	/** 待审核列表维度 */
	pending: () => [...commentKeys.all, "pending"] as const,
	/** 待审核列表查询（按分页） */
	pendingList: (query: { page?: number; limit?: number }) =>
		[...commentKeys.pending(), query] as const,
	/** 待审核数量 */
	pendingCount: () => [...commentKeys.all, "pending-count"] as const,
	/** 详情维度 */
	details: () => [...commentKeys.all, "detail"] as const,
	/** 具体详情 */
	detail: (id: string) => [...commentKeys.details(), id] as const,
};
