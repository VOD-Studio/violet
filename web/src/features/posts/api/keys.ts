import type { PostListQuery } from "../model/types";

/**
 * postKeys - 文章查询的 query key 工厂
 *
 * 用工厂模式集中管理 key，避免散落字符串导致缓存失效不彻底。
 * 子键按 list/detail 维度组织，便于按维度 invalidate。
 */
export const postKeys = {
	/** 文章模块根 key */
	all: ["posts"] as const,
	/** 文章列表维度 */
	lists: () => [...postKeys.all, "list"] as const,
	/**
	 * 具体列表查询
	 *
	 * @param query 分页与标签筛选参数
	 */
	list: (query: PostListQuery) => [...postKeys.lists(), query] as const,
	/** 文章详情维度 */
	details: () => [...postKeys.all, "detail"] as const,
	/**
	 * 具体文章详情
	 *
	 * @param slug 文章 slug
	 */
	detail: (slug: string) => [...postKeys.details(), slug] as const,
};
