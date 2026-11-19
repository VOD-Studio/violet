import type { JournalEntry, PublicNote } from "@entities/note/model/types";
import { formatDate } from "@shared/lib/date";
import type { Nodes } from "hast";
import { raw } from "hast-util-raw";

/** 手记列表每页条数；路由预取与列表查询共用同一个 queryKey。 */
export const NOTES_PAGE_LIMIT = 24;

export const JOURNAL_TIME_ZONE = "Asia/Shanghai";

const TITLE_FALLBACK_MAX = 48;
const BLOCK_ELEMENTS = {
	blockquote: true,
	br: true,
	div: true,
	h1: true,
	h2: true,
	h3: true,
	h4: true,
	h5: true,
	h6: true,
	li: true,
	p: true,
	pre: true,
	td: true,
	th: true,
};

function readText(node: Nodes, chunks: string[]) {
	if (node.type === "text") {
		chunks.push(node.value);
		return;
	}
	if (node.type === "root") {
		for (const child of node.children) readText(child, chunks);
	}
	if (node.type === "element" && !["script", "style", "template"].includes(node.tagName)) {
		const isBlock = Object.hasOwn(BLOCK_ELEMENTS, node.tagName);
		if (isBlock) chunks.push(" ");
		for (const child of node.children) readText(child, chunks);
		if (isBlock) chunks.push(" ");
	}
}

function plainText(html: string): string {
	const chunks: string[] = [];
	readText(raw({ type: "root", children: [{ type: "raw", value: html }] }), chunks);
	return chunks.join("").replace(/\s+/g, " ").trim();
}

function truncate(text: string, max: number): string {
	let offset = 0;
	for (const char of text) {
		if (max === 0) return `${text.slice(0, offset)}…`;
		offset += char.length;
		max -= 1;
	}
	return text;
}

function fallbackTitle(text: string): string {
	return truncate(text, TITLE_FALLBACK_MAX) || "无标题手记";
}

/** 笔记展示标题：无标题时以正文开头兜底，列表与详情共用同一口径。 */
export function noteTitle(note: Pick<PublicNote, "title" | "content_html">): string {
	return note.title || fallbackTitle(plainText(note.content_html));
}

/** 从公开正文提取摘要，仅保留可阅读的纯文本。 */
export function notePreview(note: Pick<PublicNote, "title" | "content_html">, max = 180) {
	const text = plainText(note.content_html);
	return { title: note.title || fallbackTitle(text), excerpt: truncate(text, max) };
}

/** 按已加载游标页的顺序归档，同一天的条目共用一个日期标题。 */
export function groupJournalDays(entries: JournalEntry[]) {
	const days = new Map<string, JournalEntry[]>();
	for (const entry of entries) {
		const day =
			entry.kind === "progress"
				? entry.progress.day
				: formatDate(entry.note.published_at, "iso-date", "", JOURNAL_TIME_ZONE);
		const group = days.get(day);
		if (group) {
			group.push(entry);
		} else {
			days.set(day, [entry]);
		}
	}
	return [...days];
}
