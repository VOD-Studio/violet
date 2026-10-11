/**
 * range-marks —— 把块内字符区间包成 <mark>，实现荧光笔式划线高亮。
 *
 * 只按文本节点切分并包裹，不改 textContent，因此 block_id 与批注偏移不受影响；
 * 区间可跨行内元素（粗体、链接等），逐个文本节点各包一段。
 */

/** KaTeX 渲染产物里同一公式有 MathML 与 HTML 两份文本，包裹会重复上色，跳过。 */
const SKIP_SELECTOR = ".katex";

export interface MarkRange {
	/** 块内起始偏移（0-based） */
	start: number;
	/** 块内结束偏移（exclusive） */
	end: number;
}

function textNodesOf(block: HTMLElement): Text[] {
	const nodes: Text[] = [];
	const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
	for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text);
	return nodes;
}

/**
 * 把块内 [start, end) 区间的文本包进带 className 的 <mark>。
 *
 * @returns 新建的 mark 元素，区间为空或落在 KaTeX 内时返回空数组
 */
export function wrapRange(
	block: HTMLElement,
	{ start, end }: MarkRange,
	className: string,
	dataset: Record<string, string> = {},
): HTMLElement[] {
	if (end <= start) return [];
	const marks: HTMLElement[] = [];
	let offset = 0;
	for (const node of textNodesOf(block)) {
		const length = node.data.length;
		const from = Math.max(start, offset) - offset;
		const to = Math.min(end, offset + length) - offset;
		offset += length;
		if (from >= to || node.parentElement?.closest(SKIP_SELECTOR)) continue;

		const middle = from > 0 ? node.splitText(from) : node;
		if (to - from < middle.data.length) middle.splitText(to - from);
		const mark = document.createElement("mark");
		mark.className = className;
		for (const [key, value] of Object.entries(dataset)) mark.dataset[key] = value;
		middle.replaceWith(mark);
		mark.append(middle);
		marks.push(mark);
	}
	return marks;
}

/** 移除 root 内所有带 className 的 mark，还原为原文本节点。 */
export function clearMarks(root: HTMLElement, className: string): void {
	const parents = new Set<Node>();
	for (const mark of root.querySelectorAll<HTMLElement>(`mark.${className}`)) {
		const parent = mark.parentNode;
		if (!parent) continue;
		mark.replaceWith(...Array.from(mark.childNodes));
		parents.add(parent);
	}
	for (const parent of parents) parent.normalize();
}
