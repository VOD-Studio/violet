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

export type JournalType = NoteType | "progress";

/** 手记共用筛选；标签只匹配手写手记。 */
export interface JournalFilters {
	type?: JournalType;
	project_id?: string;
	tag?: string;
}

/** 游标由上一页返回，与当前筛选绑定。 */
export interface JournalQuery extends JournalFilters {
	cursor?: string;
	limit?: number;
}

/** 自动采集的提交；标题为原始提交首行。 */
export interface ProgressCommit {
	sha: string;
	title: string;
	url: string;
	occurred_at: string;
}

/** 自动采集的公开仓库发布。 */
export interface ProgressRelease {
	tag: string;
	title: string;
	url: string;
	occurred_at: string;
}

/** 按上海日历日汇集的公开项目进展。 */
export interface ProgressDay {
	/** 上海本地日历日，格式 YYYY-MM-DD。 */
	day: string;
	project: NoteProject & { slug: string };
	first_at: string;
	last_at: string;
	commit_count: number;
	release_count: number;
	summary: string;
	/** 列表最多六条；日详情返回完整提交。 */
	commits: ProgressCommit[];
	releases: ProgressRelease[];
}

/** 手写手记与自动进展在公开时间线中保持各自来源。 */
export type JournalEntry =
	| { kind: "note"; note: PublicNote }
	| { kind: "progress"; progress: ProgressDay };

/** 最近一次自动同步状态；失败原因可与陈旧缓存同时存在。 */
export interface ProgressHealth {
	state: "unconfigured" | "syncing" | "ready" | "stale" | "limited" | "failed";
	reason: "limited" | "failed" | null;
	last_synced_at: string | null;
}

/** 同筛选下的一页混合时间线，自动进展不适用时状态为 null。 */
export interface JournalPage {
	entries: JournalEntry[];
	next_cursor: string | null;
	progress: ProgressHealth | null;
}
