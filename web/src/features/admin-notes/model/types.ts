import type { PageQuery } from "@shared/api/types";

/** 笔记状态。 */
export type NoteStatus = "draft" | "published";

export const NOTE_STATUS_LABELS: Record<NoteStatus, string> = {
	draft: "草稿",
	published: "已发布",
};

/** 后台笔记详情（编辑用，含 markdown 源）。 */
export interface AdminNote {
	id: string;
	author_id: string;
	/** 空串表示无标题。 */
	title: string;
	status: NoteStatus;
	content_md: string;
	content_html: string;
	tags: string[];
	created_at: string;
	updated_at: string;
	/** null 表示从未发布。 */
	published_at: string | null;
}

/** 后台笔记列表项。 */
export interface AdminNoteSummary extends Omit<AdminNote, "content_md" | "content_html"> {}

/** 后台笔记列表查询；status 缺省返回全部状态。 */
export interface AdminNoteListQuery extends PageQuery {
	status?: NoteStatus;
}

/** 笔记保存请求体；content_html 由服务端渲染。 */
export interface NoteSaveRequest {
	title: string;
	content_md: string;
	tags: string[];
}
