import type { LogListQuery } from "../model/types";

/**
 * auditLogKeys - 操作日志查询的 query key 工厂
 *
 * 用工厂模式集中管理 key，避免散落字符串导致缓存失效不彻底。
 * 子键按 list/byUser 维度组织，便于按维度 invalidate。
 */
export const auditLogKeys = {
	/** 操作日志模块根 key */
	all: ["admin-logs"] as const,
	/** 列表维度 */
	lists: () => [...auditLogKeys.all, "list"] as const,
	/**
	 * 具体列表查询
	 *
	 * @param query 分页参数
	 */
	list: (query: LogListQuery) => [...auditLogKeys.lists(), query] as const,
	/** 按用户维度 */
	byUser: () => [...auditLogKeys.all, "byUser"] as const,
	/**
	 * 具体用户的日志查询
	 *
	 * @param userId 用户 ID
	 * @param query 分页参数
	 */
	user: (userId: string, query: LogListQuery) =>
		[...auditLogKeys.byUser(), userId, query] as const,
};
