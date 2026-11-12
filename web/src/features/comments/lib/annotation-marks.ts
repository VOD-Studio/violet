import type { BlockRange } from "../model/types";

/** 同一划线区间的批注共用一处划线与一个计数。 */
export interface RangeGroup {
	/** 原始坐标 `start:end`，与批注锚点的偏移同口径，用于把批注归到划线上。 */
	key: string;
	start: number;
	end: number;
	count: number;
	/** 划线上的批注全是 AI 自署名时为首位 AI 的署名，用于按角色着色；混有读者时为 null。 */
	aiName: string | null;
	/** 划线上有文章 Owner 本人的批注 */
	byAuthor: boolean;
}

/** 批注锚点或摘要区间对应的分组键。 */
export function rangeKey(start: number, end: number): string {
	return `${start}:${end}`;
}

/** 按区间归并摘要里的批注区间，保持首次出现的先后。 */
export function groupRanges(
	ranges: readonly Pick<BlockRange, "start" | "end" | "is_ai" | "author_name" | "is_author">[],
): RangeGroup[] {
	const groups = new Map<string, { group: RangeGroup; ai: string[]; readers: number }>();
	for (const range of ranges) {
		const key = rangeKey(range.start, range.end);
		let entry = groups.get(key);
		if (!entry) {
			const group = {
				key,
				start: range.start,
				end: range.end,
				count: 0,
				aiName: null,
				byAuthor: false,
			};
			entry = { group, ai: [], readers: 0 };
			groups.set(key, entry);
		}
		entry.group.count += 1;
		entry.group.byAuthor ||= !!range.is_author && !range.is_ai;
		if (range.is_ai) entry.ai.push(range.author_name);
		else entry.readers += 1;
	}
	return [...groups.values()].map(({ group, ai, readers }) => ({
		...group,
		aiName: readers === 0 ? (ai[0] ?? null) : null,
	}));
}

/** 划线按钮的可访问名称，如「3 条批注：原文」。 */
export function markLabel(count: number, quote: string): string {
	return `${count} 条批注：${quote}`;
}

/** 页边头像组整体的可访问名称，如「本段 3 条批注」。 */
export function blockCountLabel(count: number): string {
	return `本段 ${count} 条批注`;
}

/**
 * 给同一处划线的 mark 片段补读屏语义。
 *
 * 划线跨行内元素时会拆成多个 mark：首片是带名称的按钮，名称已读出整段原文，
 * 其余片段只作视觉延伸，对读屏隐藏以免重复。
 */
export function describeMarks(marks: readonly HTMLElement[], count: number): void {
	const [first, ...rest] = marks;
	if (!first) return;
	first.setAttribute("role", "button");
	first.tabIndex = 0;
	first.setAttribute("aria-haspopup", "dialog");
	first.setAttribute("aria-expanded", "false");
	first.setAttribute("aria-label", markLabel(count, marks.map((m) => m.textContent).join("")));
	first.dataset.annotationButton = "true";
	for (const mark of rest) mark.setAttribute("aria-hidden", "true");
}
