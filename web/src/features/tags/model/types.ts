/**
 * tags 模块类型定义
 *
 * 领域读模型 Tag 见 entities/tag，此处转出供模块内部消费。
 * 写操作请求体留在本模块。
 */
import type { Tag } from "@entities/tag/model/types";

/**
 * CreateTag - 创建标签请求体
 *
 * 对接后端 POST /api/v1/tags 的请求体 binding，仅 name 必填，
 * slug 由后端 GenerateSlug 自动生成。
 */
export interface CreateTag {
    /** 标签名，必填 */
    name: string;
}

/**
 * UpdateTagRequest - 更新标签请求体
 *
 * 对接后端 PATCH /api/v1/tags/{id} 的请求体，slug 由后端按 name 自动重算。
 */
export interface UpdateTagRequest {
    /** 标签名，必填 */
    name: string;
}

// 领域读模型转出
export type { Tag };
