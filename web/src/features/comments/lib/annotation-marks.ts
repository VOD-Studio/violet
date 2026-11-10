import type { BlockRange } from "../model/types";

/** 同一划线区间的批注共用一处划线与一个计数。 */
export interface RangeGroup {
	/** 原始坐标 `start:end`，与批注锚点的偏移同口径，用于把批注归到划线上。 */
	key: string;
	start: number;
	end: number;
	count: number;
}

/** 批注锚点或摘要区间对应的分组键。 */
export function rangeKey(start: number, end: number): string {
	return `${start}:${end}`;
}

/** 按区间归并摘要里的批注区间，保持首次出现的先后。 */
export function groupRanges(ranges: readonly Pick<BlockRange, "start" | "end">[]): RangeGroup[] {
	const groups = new Map<string, RangeGroup>();
	for (const { start, end } of ranges) {
		const key = rangeKey(start, end);
		const group = groups.get(key);
		if (group) group.count += 1;
		else groups.set(key, { key, start, end, count: 1 });
	}
	return [...groups.values()];
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
