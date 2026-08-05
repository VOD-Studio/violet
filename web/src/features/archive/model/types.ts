/** archive 模块类型定义 */

/** ArchiveYearIndex - 归档年份索引 */
export interface ArchiveYearIndex {
	/** 含已发布文章的年份列表（倒序） */
	years: number[];
}

/** ArchiveItem - 归档文章项（精简字段，不含正文） */
export interface ArchiveItem {
	/** 文章 ID */
	id: string;
	/** URL slug（跳转详情） */
	slug: string;
	/** 标题 */
	title: string;
	/** 摘要 */
	excerpt: string;
	/** 封面图 URL */
	cover_image: string;
	/** 标签名列表 */
	tags: string[];
	/** 发布时间（RFC3339 字符串） */
	published_at: string;
}

/** ArchiveYear - 某年的归档数据 */
export interface ArchiveYear {
	/** 年份 */
	year: number;
	/** 该年文章数 */
	count: number;
	/** 该年全部文章（倒序，前端按月分组） */
	items: ArchiveItem[];
}
