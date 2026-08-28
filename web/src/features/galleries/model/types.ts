/**
 * galleries 模块类型定义
 *
 * 对齐后端 api/internal/application/gallery/dto.go 的 JSON 契约。
 */

/** 图集标题上限（rune 计，对齐后端 domain/gallery.TitleMaxRunes） */
export const GALLERY_TITLE_MAX = 100;
/** 图集描述上限（rune 计，对齐后端 DescriptionMaxRunes） */
export const GALLERY_DESCRIPTION_MAX = 2000;
/** 单项 caption 上限（rune 计，对齐后端 CaptionMaxRunes） */
export const GALLERY_CAPTION_MAX = 200;
/** 单图集媒体项上限（对齐后端 ItemsMax） */
export const GALLERY_ITEMS_MAX = 50;

export interface GalleryAuthor {
	id: string;
	username: string;
	avatar_url: string;
}

export interface GalleryItem {
	file_id: string;
	/** 媒体访问地址；视频项为源文件，列表态用 thumbnail */
	url: string;
	/** 缩略图地址；视频项为 ffmpeg 首帧，无则空串 */
	thumbnail: string;
	mime_type: string;
	/** 原始尺寸；非图片或未知为 null */
	width: number | null;
	height: number | null;
	caption: string;
}

/** 图集列表卡片（后端 GalleryDTO） */
export interface GallerySummary {
	id: string;
	title: string;
	description: string;
	/** 封面访问地址（指定封面或首项媒体；文件缺失为空串） */
	cover_url: string;
	item_count: number;
	status: "published" | "removed" | (string & {});
	author: GalleryAuthor;
	created_at: string;
	updated_at: string;
}

/** 图集详情（后端 GalleryDetailDTO） */
export interface GalleryDetail extends GallerySummary {
	items: GalleryItem[];
}

/** 建/编图集的媒体项提交形态 */
export interface GalleryItemInput {
	file_id: string;
	caption: string;
}

/** POST /galleries 请求体 */
export interface CreateGalleryInput {
	title: string;
	description: string;
	/** 封面文件 ID；省略 = 取首项媒体当封面 */
	cover_file_id?: string;
	items: GalleryItemInput[];
}

/** PATCH /galleries/{id} 请求体 */
export interface UpdateGalleryInput {
	title: string;
	description: string;
	cover_file_id?: string;
	/** 显式清空封面（回退首项媒体） */
	clear_cover?: boolean;
	/** 媒体项全量替换；省略 = 不改动媒体列表 */
	items?: GalleryItemInput[];
}
