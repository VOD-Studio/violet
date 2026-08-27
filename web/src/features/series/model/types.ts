/** 书架项（GET /series） */
export interface SeriesSummary {
	id: string;
	slug: string;
	title: string;
	description: string;
	/** 封面图 URL；空串=无封面（排版式书衣） */
	cover_image: string;
	/** 已发布章节数 */
	chapter_count: number;
	/** 最近一章发布时间，RFC3339；空串=尚无发布章节 */
	latest_chapter_at: string;
	created_at: string;
}

/** 卷 */
export interface SeriesSection {
	id: string;
	title: string;
	sort_order: number;
}

/** 目录章节项 */
export interface SeriesChapter {
	post_id: string;
	slug: string;
	title: string;
	/** 全书展示序号（1 起，按可见章节连续编号） */
	chapter_no: number;
	/** RFC3339 */
	published_at: string;
}

/** 卷 + 卷内章节 */
export interface SeriesSectionChapters {
	section: SeriesSection;
	chapters: SeriesChapter[];
}

/** 书籍详情（GET /series/{slug}）：两层目录 = 根章节 + 卷[] */
export interface SeriesDetail {
	id: string;
	slug: string;
	title: string;
	description: string;
	cover_image: string;
	chapter_count: number;
	latest_chapter_at: string;
	created_at: string;
	sections: SeriesSectionChapters[];
	root_chapters: SeriesChapter[];
}

/** 相邻章导航 */
export interface ChapterNav {
	slug: string;
	title: string;
}

/** 文章的书籍上下文（GET /series/context/{postSlug}）；无归属为 null */
export interface ChapterContext {
	series: { slug: string; title: string };
	chapter_no: number;
	total_chapters: number;
	/** 首章为 null */
	prev_chapter: ChapterNav | null;
	/** 末章为 null */
	next_chapter: ChapterNav | null;
}
