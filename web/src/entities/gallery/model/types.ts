import type { PageQuery } from "@shared/api/types";

/** 图集工作稿状态。 */
export type GalleryStatus = "draft";

/** 管理端图集列表投影。 */
export interface GallerySummary {
	id: string;
	author_id: string;
	title: string;
	summary: string;
	status: GalleryStatus;
	version: number;
	item_count: number;
	created_at: string;
	updated_at: string;
}

/** 工作稿中的单张图片投影。 */
export interface GalleryItem {
	file_id: string;
	/** 服务端归一化后的零基顺序。保存时不回传。 */
	position: number;
	url: string;
	thumbnail: string;
	mime_type: string;
	width: number;
	height: number;
	asset_alt_text: string;
	caption: string;
	alt_text_override: string;
}

/** 管理端图集工作稿详情。 */
export interface GalleryDetail extends GallerySummary {
	items: GalleryItem[];
}

/** 管理端列表分页参数。 */
export interface GalleryListQuery extends PageQuery {}
