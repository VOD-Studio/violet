import type { PageQuery } from "@shared/api/types";

/** 管理书列表查询参数 */
export interface AdminSeriesListQuery extends PageQuery {
	keyword?: string;
}

/** 管理书列表项（GET /admin/series） */
export interface AdminSeriesListItem {
	id: string;
	slug: string;
	title: string;
	description: string;
	/** 封面图 URL；空串=无封面 */
	cover_image: string;
	/** 已发布章节数 */
	chapter_count: number;
	/** 全部章节数（含 draft/archived） */
	total_chapter_count: number;
	/** 最近一章发布时间，RFC3339；空串=尚无发布章节 */
	latest_chapter_at: string;
	created_at: string;
	updated_at: string;
	/** draft / published */
	status: string;
}

/** 卷 */
export interface SeriesSectionDTO {
	id: string;
	title: string;
	sort_order: number;
}

/** 目录章节项 */
export interface SeriesChapterDTO {
	post_id: string;
	slug: string;
	title: string;
	/** 全书展示序号（1 起） */
	chapter_no: number;
	/** 文章状态；公开视角省略 */
	status?: string;
	/** RFC3339；未发布为空串 */
	published_at: string;
}

/** 卷 + 卷内章节 */
export interface SeriesSectionChapters {
	section: SeriesSectionDTO;
	chapters: SeriesChapterDTO[];
}

/** 书详情（含两层目录） */
export interface AdminSeriesDetail extends AdminSeriesListItem {
	/** 卷列表（sort_order 升序，含空卷） */
	sections: SeriesSectionChapters[];
	/** 书根章节（无卷） */
	root_chapters: SeriesChapterDTO[];
}

/** 挂章入参 */
export interface AttachChaptersInput {
	post_ids: string[];
	/** 挂入的卷 ID；空串=书根 */
	section_id?: string;
	/** 挂到该章之后；空串=所在范围末尾 */
	after_post_id?: string;
}

/** 全树调序单范围 */
export interface ReorderScope {
	/** 卷 ID；空串=书根 */
	section_id: string;
	ordered_post_ids: string[];
}
