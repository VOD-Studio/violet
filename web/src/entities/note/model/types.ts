export const NOTE_TYPES = ["unclassified", "pitfall", "idea", "excerpt"] as const;

export type NoteType = (typeof NOTE_TYPES)[number];

export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
	unclassified: "未分类",
	pitfall: "踩坑",
	idea: "想法",
	excerpt: "摘录",
};

/** 手记关联的公开项目摘要。 */
export interface NoteProject {
	id: string;
	title: string;
}

/** 踩坑信息；空字符串表示该段尚未填写。 */
export interface NotePitfall {
	symptom: string;
	cause: string;
	remedy: string;
	resolved: boolean;
	code: string;
}

/** 公开笔记投影。 */
export interface PublicNote {
	id: string;
	/** 空串表示无标题，展示层以正文截断兜底。 */
	title: string;
	content_html: string;
	tags: string[];
	published_at: string;
	type: NoteType;
	/** 未关联项目（或已解除关联）时为 null。 */
	project: NoteProject | null;
	/** 非踩坑手记为 null。 */
	pitfall: NotePitfall | null;
}

/** 公开笔记游标分页参数。 */
export interface PublicNoteListQuery {
	cursor?: string;
	limit?: number;
	/** 标签 slug 筛选。 */
	tag?: string;
	type?: NoteType;
	project_id?: string;
}
