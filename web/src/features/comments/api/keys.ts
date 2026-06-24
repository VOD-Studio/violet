import type { AdminCommentListQuery, CommentListQuery } from "../model/types";

/**
 * commentKeys - 评论模块查询的 query key 工厂
 *
 * 用工厂模式集中管理 key，避免散落字符串导致缓存失效不彻底。
 * 维度按 list / reactions / admin 组织，便于按维度 invalidate。
 */
export const commentKeys = {
	/** 评论模块根 key */
	all: ["comments"] as const,
	/** 前台评论列表维度 */
	lists: () => [...commentKeys.all, "list"] as const,
	/**
	 * 具体文章的评论列表
	 *
	 * @param postId 文章 ID
	 * @param query 分页参数
	 */
	list: (postId: string, query: CommentListQuery) =>
		[...commentKeys.lists(), postId, query] as const,
	/** 评论反应维度 */
	reactions: () => [...commentKeys.all, "reactions"] as const,
	/**
	 * 具体评论的反应列表
	 *
	 * @param commentId 评论 ID
	 */
	reactionList: (commentId: string) =>
		[...commentKeys.reactions(), commentId] as const,
	/** 后台评论维度 */
	admin: () => [...commentKeys.all, "admin"] as const,
	/** 后台待审核评论列表维度 */
	pending: () => [...commentKeys.admin(), "pending"] as const,
	/**
	 * 具体待审核评论列表查询
	 *
	 * @param query 分页参数
	 */
	pendingList: (query: CommentListQuery) =>
		[...commentKeys.pending(), query] as const,
	/** 待审核评论数量维度 */
	pendingCount: () => [...commentKeys.pending(), "count"] as const,
	/** 后台全部评论列表维度 */
	adminLists: () => [...commentKeys.admin(), "list"] as const,
	/**
	 * 具体后台评论列表查询
	 *
	 * @param query 分页与状态筛选参数
	 */
	adminList: (query: AdminCommentListQuery) =>
		[...commentKeys.adminLists(), query] as const,
	/** 后台评论详情维度 */
	adminDetails: () => [...commentKeys.admin(), "detail"] as const,
	/**
	 * 具体后台评论详情
	 *
	 * @param id 评论 ID
	 */
	adminDetail: (id: string) => [...commentKeys.adminDetails(), id] as const,
};
