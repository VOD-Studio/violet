import type { PageQuery } from "@shared/api/types";

/**
 * MediaFile 与 MediaType - 媒体领域实体类型定义（纯类型）
 */

/**
 * 文件用途分类（对齐后端 domain/upload/entity.go 中的 purposePattern 校验）
 *
 * - material: 通用素材库（默认）
 * - avatar: 用户头像（仅图片）
 * - emoji: 自定义表情（仅图片/动图）
 * - post: 文章配图 / 附件
 * - comment: 评论配图
 * - tweet: 推文配图
 */
export type MediaPurpose = "material" | "avatar" | "post" | "emoji" | "comment" | "tweet";

/** 素材类型，按 MIME 大类划分（对齐后端 application/media/service.go MimeCategory） */
export type MediaType = "image" | "video" | "audio" | "file";

/** 全站素材目录的分页与筛选参数。 */
export interface MediaCatalogQuery extends PageQuery {
	purpose?: string;
	type?: MediaType | string;
	category?: string;
	keyword?: string;
}

/**
 * MediaFile - 媒体文件读模型
 *
 * 对应后端 FileDTO，GET /media/{id} 与列表接口共用。
 */
export interface MediaFile {
	/** 文件 ID，UUID */
	id: string;
	/** 所有者用户 ID */
	owner_id: string;
	/** 用途分类，如 material / avatar / post / emoji / comment / tweet */
	purpose: MediaPurpose | string;
	/** 原始文件名 */
	original_name: string;
	/** 可访问 URL */
	url: string;
	/** 文件大小，单位字节 */
	size: number;
	/** MIME 类型 */
	mime_type: string;
	/** 缩略图 URL，无缩略图为空串 */
	thumbnail: string;
	/** 文件状态，如 active / deleted */
	status: string;
	/** 替代文本/素材描述，无障碍与 SEO 用 */
	alt_text?: string;
	/** 用户自定义分类 */
	category?: string;
	/** 创建时间，RFC3339 字符串 */
	created_at: string;
	/** 更新时间，RFC3339 字符串，缩略图版本号用 */
	updated_at?: string;
}
