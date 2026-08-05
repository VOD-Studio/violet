/**
 * media 模块类型定义
 *
 * 前台素材库的查询参数与批量删除。领域读模型 MediaFile、MediaType 见 entities/media。
 * 后台管理类型见 admin-media，上传类型见 upload。
 */
import type { MediaFile, MediaType } from "@entities/media/model/types";

/**
 * MediaListQuery - 媒体列表查询参数
 *
 * 后端 ListFiles handler 解析 page/limit/purpose 三个 query 参数，
 * purpose 为用途筛选，不传则返回全部用途。
 */
export interface MediaListQuery {
	/** 页码，从 1 开始，默认 1 */
	page?: number;
	/** 每页条数，默认 20，后端限制上限 100 */
	limit?: number;
	/** 用途筛选，如 material / avatar / cover */
	purpose?: string;
}

/**
 * BatchDeleteRequest - 批量删除请求体
 *
 * 对接 POST /media/batch-delete，handler 要求 ids 至少一个。
 */
export interface BatchDeleteRequest {
	/** 待删除媒体 ID 列表 */
	ids: string[];
}

/**
 * BatchDeleteResult - 批量删除结果
 *
 * 后端返回实际删除条数，被引用未删的不计入。
 */
export interface BatchDeleteResult {
	/** 实际删除数量 */
	deleted: number;
}

// 领域读模型转出
export type { MediaFile, MediaType };
