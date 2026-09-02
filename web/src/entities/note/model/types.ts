/** 公开笔记投影。 */
export interface PublicNote {
	id: string;
	/** 空串表示无标题，展示层以正文截断兜底。 */
	title: string;
	content_html: string;
	tags: string[];
	published_at: string;
}

/** 公开笔记游标分页参数。 */
export interface PublicNoteListQuery {
	cursor?: string;
	limit?: number;
	/** 标签 slug 筛选。 */
	tag?: string;
}
