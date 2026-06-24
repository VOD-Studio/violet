import type { ProjectListQuery } from "../model/types";

/**
 * projectKeys - 项目查询的 query key 工厂
 *
 * 用工厂模式集中管理 key，避免散落字符串导致缓存失效不彻底。
 * 子键按 list/detail 维度组织，便于按维度 invalidate。
 */
export const projectKeys = {
	/** 项目模块根 key */
	all: ["projects"] as const,
	/** 项目列表维度 */
	lists: () => [...projectKeys.all, "list"] as const,
	/**
	 * 具体列表查询
	 *
	 * @param query 分页参数，当前后端未生效，仅参与 key 区分
	 */
	list: (query: ProjectListQuery) => [...projectKeys.lists(), query] as const,
	/** 项目详情维度 */
	details: () => [...projectKeys.all, "detail"] as const,
	/**
	 * 具体项目详情
	 *
	 * @param id 项目 ID
	 */
	detail: (id: string) => [...projectKeys.details(), id] as const,
};
