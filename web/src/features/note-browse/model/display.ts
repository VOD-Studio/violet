import type { PublicNote } from "@entities/note/model/types";

/** 无标题笔记的正文兜底截断长度。 */
const TITLE_FALLBACK_MAX = 48;

/** 把 content_html 压成单行纯文本并截断。 */
export function noteExcerpt(html: string, max: number): string {
	const text = html
		.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	if (text.length <= max) return text;
	return `${text.slice(0, max)}…`;
}

/** 笔记展示标题：无标题时以正文开头兜底，列表与详情共用同一口径。 */
export function noteTitle(note: Pick<PublicNote, "title" | "content_html">): string {
	return note.title || noteExcerpt(note.content_html, TITLE_FALLBACK_MAX);
}

/** 列表行日期：yyyy-mm-dd 等宽呈现。 */
export function noteDate(iso: string): string {
	return iso.slice(0, 10);
}
