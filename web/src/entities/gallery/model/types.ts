import type { PageQuery } from "@shared/api/types";

/** 图集状态。 */
export type GalleryStatus = "draft" | "published" | "modified" | "unpublished";

/** 管理端图集列表投影。 */
export interface GallerySummary {
	id: string;
	author_id: string;
	/** 作者可读名（display_name 优先，缺省 username）；用户不存在时为空串。 */
	author_name: string;
	title: string;
	summary: string;
	status: GalleryStatus;
	slug: string | null;
	published_at: string | null;
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

/** 管理端列表分页参数。author 精确匹配用户名，status 取图集状态。 */
export interface GalleryListQuery extends PageQuery {
	author?: string;
	status?: GalleryStatus;
}

/** 公开图集中的单张图片。 */
export interface PublishedGalleryItem {
	file_id: string;
	position: number;
	thumbnail: string;
	url: string;
	width: number;
	height: number;
	alt_text: string;
	caption: string;
}

/** 公开图集投影。 */
export interface PublishedGallery {
	id: string;
	slug: string;
	title: string;
	summary: string;
	published_at: string;
	items: PublishedGalleryItem[];
}

/** 公开图集游标分页参数。 */
export interface PublishedGalleryListQuery {
	cursor?: string;
	limit?: number;
}
