/**
 * range-marks —— 把块内字符区间包成 <mark>，实现荧光笔式划线高亮。
 *
 * 偏移与 getBlockText 同口径：行内公式等 carrier 按 data-latex / data-source 计长，
 * 不按 KaTeX DOM textContent，避免选区锚点与高亮错位。
 */

export interface MarkRange {
	/** 块内起始偏移（0-based，carrier 口径） */
	start: number;
	/** 块内结束偏移（exclusive） */
	end: number;
}

const MATH_TYPES = new Set(["inline-math", "block-math"]);

function isCarrierRoot(el: HTMLElement): boolean {
	const dataType = el.getAttribute("data-type");
	if (dataType && MATH_TYPES.has(dataType)) return true;
	if (dataType === "diagram-block") return true;
	return el.dataset.runnable === "true";
}

/**
 * 把块内 [start, end) 区间的文本包进带 className 的 <mark>。
 *
 * 块根若本身是 carrier（可运行 CodeRunner / 块级公式等），不向子树套 mark，
 * 避免把 source 偏移误应用到工具栏/编辑器 DOM。
 *
 * @returns 新建的 mark 元素；区间为空或仅落在 carrier/KaTeX 内时可能为空数组
 */
export function wrapRange(
	block: HTMLElement,
	{ start, end }: MarkRange,
	className: string,
	dataset: Record<string, string> = {},
): HTMLElement[] {
	if (end <= start) return [];
	// 整块即 carrier：无可划线文本流（段评靠角标），禁止改子树
	if (isCarrierRoot(block)) return [];

	const marks: HTMLElement[] = [];
	let offset = 0;

	const wrapText = (node: Text, skipWrap: boolean) => {
		const length = node.data.length;
		const from = Math.max(start, offset) - offset;
		const to = Math.min(end, offset + length) - offset;
		offset += length;
		if (skipWrap || from >= to) return;

		const middle = from > 0 ? node.splitText(from) : node;
		if (to - from < middle.data.length) middle.splitText(to - from);
		const mark = document.createElement("mark");
		mark.className = className;
		for (const [key, value] of Object.entries(dataset)) mark.dataset[key] = value;
		middle.replaceWith(mark);
		mark.append(middle);
		marks.push(mark);
	};

	const walk = (node: Node, skipWrap: boolean) => {
		if (node.nodeType === Node.ELEMENT_NODE) {
			const el = node as HTMLElement;
			const dataType = el.getAttribute("data-type");
			if (dataType && MATH_TYPES.has(dataType)) {
				offset += (el.getAttribute("data-latex") ?? "").length;
				return;
			}
			if (dataType === "diagram-block") {
				offset += (el.getAttribute("data-source") ?? "").length;
				return;
			}
			if (el.dataset.runnable === "true") {
				offset += (el.dataset.source ?? "").length;
				return;
			}
			const nextSkip = skipWrap || el.classList.contains("katex");
			for (const child of Array.from(el.childNodes)) {
				walk(child, nextSkip);
			}
			return;
		}
		if (node.nodeType === Node.TEXT_NODE) {
			wrapText(node as Text, skipWrap);
		}
	};

	for (const child of Array.from(block.childNodes)) {
		walk(child, false);
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

/**
 * 构建 legacy textContent 偏移 → carrier 偏移的边界表。
 * map[i] = 消费 i 个 legacy 字符后的 carrier 偏移（map.length === legacyLen+1）。
 */
function buildLegacyToCarrierMap(block: HTMLElement): number[] {
	const map: number[] = [0];
	let carrier = 0;

	const consumeText = (text: string) => {
		for (let i = 0; i < text.length; i++) {
			carrier += 1;
			map.push(carrier);
		}
	};

	/** legacy 子树长度映射到 carrierLen 个 carrier 字符（公式等）。 */
	const consumeCarrierSpan = (legacyLen: number, carrierLen: number) => {
		const c0 = carrier;
		carrier += carrierLen;
		if (legacyLen <= 0) return;
		for (let i = 1; i <= legacyLen; i++) {
			map.push(c0 + Math.round((i / legacyLen) * carrierLen));
		}
		map[map.length - 1] = carrier;
	};

	const walk = (node: Node) => {
		if (node.nodeType === Node.ELEMENT_NODE) {
			const el = node as HTMLElement;
			const dataType = el.getAttribute("data-type");
			if (dataType && MATH_TYPES.has(dataType)) {
				consumeCarrierSpan(
					(el.textContent ?? "").length,
					(el.getAttribute("data-latex") ?? "").length,
				);
				return;
			}
			if (dataType === "diagram-block") {
				consumeCarrierSpan(
					(el.textContent ?? "").length,
					(el.getAttribute("data-source") ?? "").length,
				);
				return;
			}
			if (el.dataset.runnable === "true") {
				consumeCarrierSpan((el.textContent ?? "").length, (el.dataset.source ?? "").length);
				return;
			}
			for (const child of Array.from(el.childNodes)) walk(child);
			return;
		}
		if (node.nodeType === Node.TEXT_NODE) {
			consumeText(node.textContent ?? "");
		}
	};

	for (const child of Array.from(block.childNodes)) walk(child);
	return map;
}

/**
 * 把历史 textContent（KaTeX）坐标区间映射到现行 carrier 坐标。
 * 按 DOM 双轨推进偏移，重复子串（如 foo ⟨公式⟩ foo）保留原始位置对应的 occurrence。
 */
export function mapLegacyRangeToCarrier(block: HTMLElement, range: MarkRange): MarkRange {
	const map = buildLegacyToCarrierMap(block);
	if (map.length <= 1) return { start: 0, end: 0 };
	const max = map.length - 1;
	const start = Math.max(0, Math.min(range.start, max));
	const end = Math.max(start, Math.min(range.end, max));
	const cs = map[start] ?? 0;
	const ce = map[end] ?? cs;
	return { start: cs, end: Math.max(cs, ce) };
}
