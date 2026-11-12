/**
 * selection-to-anchor —— 从浏览器 Selection 提取 Anchor（DOM 包装层）。
 *
 * buildAnchorFromRange 是纯函数（输入规范化数据），selectionToAnchor 是它的 DOM 包装：
 * 从 Selection 取 Range，定位所在块级元素，算 blockId + 块内 offset，调纯函数。
 *
 * 块内 offset：对「块首 → 选区端点」做 Range.cloneContents()，再用 measureCarrierText
 * 按与 getBlockText 相同的 carrier 口径计长（公式用 data-latex、可运行块用 data-source），
 * 不用 Range.toString()（后者含 KaTeX DOM 文本，会与锚点哈希坐标系错位）。
 * 选区落在 carrier 内部时先吸附到 carrier 边界。
 *
 * 跨块判定：选区起点和终点所在块不同 → buildAnchorFromRange 返回 null。
 *
 * 不可批注容器：代码块（shiki pre）、图块、块级公式等语义上不可批注的块，
 * 命中时 selectionToAnchor 返回 null，FloatingToolbar 据此隐藏（区别于跨块置灰）。
 */

import { computeBlockId } from "./block-id";
import { getBlockText, measureCarrierText } from "./extract-blocks";
import { buildAnchorFromRange } from "./range-to-anchor";
import type { Anchor } from "./types";

/** 新批注仅锚定正文文本块；历史定位仍使用 extract-blocks 的完整选择器。 */
const BLOCK_SELECTOR = "p, h1, h2, h3, h4, h5, h6, li, blockquote";

/** 不可批注的内容既不能独立锚定，也不能混进文本块选区。 */
const UNANNOTATABLE_SELECTOR =
	"th, td, figure, figcaption, img, summary, pre, .katex-display, .cm-editor, [data-runnable='true'], [data-type='diagram-block'], [data-type='block-math'], [data-article-embed]";

/** 文本块里嵌着这些内容时整块不可批注（其内部的纯文本段落仍可）；图片不在此列，图文混排段落可整段批注。 */
const UNANNOTATABLE_CONTENT_SELECTOR =
	"table, figure, summary, pre, .katex-display, .cm-editor, [data-runnable='true'], [data-type='diagram-block'], [data-type='block-math'], [data-article-embed]";

/** 检测选区是否碰到不可批注的节点（包括从文本块跨入它的选区）。 */
export function isSelectionInUnannotatableContainer(range: Range): boolean {
	const start =
		range.startContainer.nodeType === Node.ELEMENT_NODE
			? (range.startContainer as Element)
			: range.startContainer.parentElement;
	const end =
		range.endContainer.nodeType === Node.ELEMENT_NODE
			? (range.endContainer as Element)
			: range.endContainer.parentElement;
	if (start?.closest(UNANNOTATABLE_SELECTOR) || end?.closest(UNANNOTATABLE_SELECTOR)) return true;
	const ancestor = range.commonAncestorContainer;
	const parent =
		ancestor.nodeType === Node.ELEMENT_NODE ? (ancestor as Element) : ancestor.parentElement;
	return (
		parent != null &&
		Array.from(parent.querySelectorAll(UNANNOTATABLE_SELECTOR)).some((el) =>
			range.intersectsNode(el),
		)
	);
}

/**
 * 找到节点所在的最近块级元素（向上遍历父链）。
 * 如果节点本身就在块外（如 body），返回 null。
 */
function findClosestBlock(node: Node | null): HTMLElement | null {
	let current: Node | null = node;
	while (current && current.nodeType !== Node.ELEMENT_NODE) {
		current = current.parentNode;
	}
	return (current as HTMLElement | null)?.closest<HTMLElement>(BLOCK_SELECTOR) ?? null;
}

/** 新建批注的目标块：正文文本块、有实际文字，且自身不在也不包含不可批注内容。 */
export function isAnnotatableBlock(block: HTMLElement): boolean {
	return (
		block.matches(BLOCK_SELECTOR) &&
		!block.closest(UNANNOTATABLE_SELECTOR) &&
		!block.querySelector(UNANNOTATABLE_CONTENT_SELECTOR) &&
		getBlockText(block).trim().length > 0
	);
}

export type SelectionCapability = "annotatable" | "cross-block" | "unsupported";

/** 在计算锚点前区分跨文本块选区与命中不支持节点的选区。 */
export function selectionCapability(range: Range, root: HTMLElement): SelectionCapability {
	if (!root.contains(range.startContainer) || !root.contains(range.endContainer))
		return "unsupported";
	if (isSelectionInUnannotatableContainer(range)) return "unsupported";
	const startBlock = findClosestBlock(range.startContainer);
	const endBlock = findClosestBlock(range.endContainer);
	if (
		!startBlock ||
		!endBlock ||
		!isAnnotatableBlock(startBlock) ||
		!isAnnotatableBlock(endBlock)
	)
		return "unsupported";
	return startBlock === endBlock ? "annotatable" : "cross-block";
}

/** 公式/图块/可运行块 carrier：选区落在内部时吸附到 carrier 边界，与 getBlockText 同口径。 */
const CARRIER_SELECTOR =
	"[data-type='inline-math'], [data-type='block-math'], [data-type='diagram-block'], [data-runnable='true']";

function snapOutsideCarrier(
	blockEl: HTMLElement,
	node: Node,
	offset: number,
	edge: "start" | "end",
): { node: Node; offset: number } {
	const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
	if (!el) return { node, offset };
	const carrier = el.closest(CARRIER_SELECTOR) as HTMLElement | null;
	if (!carrier || carrier === blockEl || !blockEl.contains(carrier)) return { node, offset };
	const parent = carrier.parentNode;
	if (!parent) return { node, offset };
	const index = Array.prototype.indexOf.call(parent.childNodes, carrier);
	if (index < 0) return { node, offset };
	if (edge === "start") return { node: parent, offset: index };
	return { node: parent, offset: index + 1 };
}

/**
 * 算「块首 → 端点」的 carrier 口径字符 offset（与 getBlockText / wrapRange 一致）。
 * 调用方须先 snapOutsideCarrier；公式按 data-latex 计长，不用 KaTeX textContent。
 */
function offsetWithinBlock(blockEl: HTMLElement, endNode: Node, endOffset: number): number {
	const range = document.createRange();
	range.setStart(blockEl, 0);
	try {
		range.setEnd(endNode, endOffset);
	} catch {
		return -1;
	}
	return measureCarrierText(range.cloneContents()).length;
}

/**
 * 悬停目标所属的可批注块；落在正文外或不可批注容器内返回 null。
 * 供「悬停段评入口」判断鼠标当前指向哪一段。
 *
 * 外层块的文字与内层块相同时（如只含一个段落的引用块）取最外层：块标识相同，
 * 批注挂在最外层那一个上（findBlockElement 同口径），悬停引用块外框与段落文字不会指向两处。
 */
export function closestAnnotatableBlock(
	target: EventTarget | null,
	root: HTMLElement,
): HTMLElement | null {
	if (!(target instanceof Node)) return null;
	const inner = findClosestBlock(target);
	if (!inner || !root.contains(inner) || !isAnnotatableBlock(inner)) return null;
	const element =
		target.nodeType === Node.ELEMENT_NODE ? (target as Element) : target.parentElement;
	if (element?.closest(UNANNOTATABLE_SELECTOR)) return null;
	const text = getBlockText(inner).trim();
	let block = inner;
	for (
		let parent = block.parentElement?.closest<HTMLElement>(BLOCK_SELECTOR);
		parent && root.contains(parent) && getBlockText(parent).trim() === text;
		parent = block.parentElement?.closest<HTMLElement>(BLOCK_SELECTOR)
	) {
		block = parent;
	}
	return block;
}

/**
 * 正文里能发起段评的块，按文档顺序、去重后列出；与悬停判定同一口径。
 *
 * @remarks 供键盘在段落之间移动段评入口。
 */
export function listAnnotatableBlocks(root: HTMLElement): HTMLElement[] {
	const blocks = new Set<HTMLElement>();
	for (const element of root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)) {
		const block = closestAnnotatableBlock(element, root);
		if (block) blocks.add(block);
	}
	return [...blocks];
}

export interface SelectionToAnchorOptions {
	/** 选区所在正文容器（用于校验选区在正文内） */
	root: HTMLElement;
}

/** 从单个受支持文本块的选区生成锚点；无效或不支持的选区不生成锚点。 */
export async function selectionToAnchor(opts: SelectionToAnchorOptions): Promise<Anchor | null> {
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

	const range = selection.getRangeAt(0);
	if (selectionCapability(range, opts.root) !== "annotatable") return null;
	const startBlock = findClosestBlock(range.startContainer);
	if (!startBlock) return null;
	const blockText = getBlockText(startBlock);
	const blockId = await computeBlockId(blockText);
	if (blockId === null) return null;

	// 算块内 startOffset / endOffset（carrier 口径；落在公式内则吸附到边界）
	const startSnap = snapOutsideCarrier(
		startBlock,
		range.startContainer,
		range.startOffset,
		"start",
	);
	const endSnap = snapOutsideCarrier(startBlock, range.endContainer, range.endOffset, "end");
	const startOffset = offsetWithinBlock(startBlock, startSnap.node, startSnap.offset);
	const endOffset = offsetWithinBlock(startBlock, endSnap.node, endSnap.offset);
	if (startOffset < 0 || endOffset < 0 || startOffset >= endOffset) return null;

	return buildAnchorFromRange({
		blockId,
		blockText,
		startOffset,
		endOffset,
	});
}

/** 清除当前选区（提交批注后调用，避免工具条残留）。 */
export function clearSelection(): void {
	window.getSelection()?.removeAllRanges();
}
