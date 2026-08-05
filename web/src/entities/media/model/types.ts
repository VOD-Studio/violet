/**
 * MediaFile 与 MediaType - 媒体领域实体
 *
 * 前台素材选择与后台媒体管理共享的读模型，跨 feature 复用故归 entities 层，
 * 放置惯例对齐 entities/user、entities/post。
 */

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
	/** 用途分类，如 material / avatar / cover */
	purpose: string;
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

/** 素材类型，按 MIME 大类划分 */
export type MediaType = "image" | "video" | "audio" | "file";
