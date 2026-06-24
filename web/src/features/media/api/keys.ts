import type { MediaListQuery } from "../model/types";

/**
 * mediaKeys - 媒体文件查询的 query key 工厂
 *
 * 用工厂模式集中管理 key，避免散落字符串导致缓存失效不彻底。
 * 子键按 list/detail/upload 维度组织，便于按维度 invalidate。
 */
export const mediaKeys = {
	/** 媒体模块根 key */
	all: ["media"] as const,
	/** 列表维度 */
	lists: () => [...mediaKeys.all, "list"] as const,
	/**
	 * 具体列表查询
	 *
	 * @param query 分页与用途筛选参数
	 */
	list: (query: MediaListQuery) => [...mediaKeys.lists(), query] as const,
	/** 详情维度 */
	details: () => [...mediaKeys.all, "detail"] as const,
	/**
	 * 具体媒体详情
	 *
	 * @param id 媒体 ID
	 */
	detail: (id: string) => [...mediaKeys.details(), id] as const,
	/** 上传会话状态维度 */
	uploads: () => [...mediaKeys.all, "upload"] as const,
	/**
	 * 具体上传会话状态
	 *
	 * @param uploadId 上传会话 ID
	 */
	uploadStatus: (uploadId: string) => [...mediaKeys.uploads(), "status", uploadId] as const,
};

/**
 * adminFileKeys - admin 文件管理查询的 query key 工厂
 *
 * /admin/files 路由与 /media 复用同一 handler 但语义上属管理后台，
 * 单独维护 key 命名空间便于按维度 invalidate 而不影响前台列表。
 */
export const adminFileKeys = {
	/** admin 文件模块根 key */
	all: ["admin-files"] as const,
	/** 列表维度 */
	lists: () => [...adminFileKeys.all, "list"] as const,
	/**
	 * 具体列表查询
	 *
	 * @param query 分页与用途筛选参数
	 */
	list: (query: MediaListQuery) => [...adminFileKeys.lists(), query] as const,
	/** 秒传检查维度 */
	instant: () => [...adminFileKeys.all, "instant"] as const,
	/**
	 * 具体秒传检查
	 *
	 * @param hash 文件哈希
	 */
	instantCheck: (hash: string) => [...adminFileKeys.instant(), hash] as const,
};
