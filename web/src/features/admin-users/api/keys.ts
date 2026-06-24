import type { UserListQuery } from "../model/types";

/**
 * adminUserKeys - 用户管理查询的 query key 工厂
 *
 * 用工厂模式集中管理 key，避免散落字符串导致缓存失效不彻底。
 * 子键按 list/detail 维度组织，便于按维度 invalidate。
 */
export const adminUserKeys = {
	/** 用户管理模块根 key */
	all: ["admin-users"] as const,
	/** 列表维度 */
	lists: () => [...adminUserKeys.all, "list"] as const,
	/**
	 * 具体列表查询
	 *
	 * @param query 分页与筛选参数
	 */
	list: (query: UserListQuery) => [...adminUserKeys.lists(), query] as const,
	/** 详情维度 */
	details: () => [...adminUserKeys.all, "detail"] as const,
	/**
	 * 具体用户详情
	 *
	 * @param id 用户 ID
	 */
	detail: (id: string) => [...adminUserKeys.details(), id] as const,
};
