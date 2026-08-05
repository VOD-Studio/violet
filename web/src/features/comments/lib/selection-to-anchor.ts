/**
 * selection-to-anchor —— 从浏览器 Selection 提取 Anchor（DOM 包装层）。
 *
 * buildAnchorFromRange 是纯函数（输入规范化数据），selectionToAnchor 是它的 DOM 包装：
 * 从 Selection 取 Range，定位所在块级元素，算 blockId + 块内 offset，调纯函数。
 *
 * 块内 offset 计算：用 Range API 创建「块首 → 选区起点」的 Range，其 toString().length
 * 即 startOffset（DOM 节点级 offset 转块文本级 offset 的标准技巧）。
 *
 * 跨块判定：选区起点和终点所在块不同 → buildAnchorFromRange 返回 null。
 *
 * 不可批注容器：代码块（shiki pre）、图块、块级公式等语义上不可批注的块，
 * 命中时 selectionToAnchor 返回 null，FloatingToolbar 据此隐藏（区别于跨块置灰）。
 */

import { computeBlockId } from "./block-id";
import { getBlockText } from "./extract-blocks";
import { buildAnchorFromRange } from "./range-to-anchor";
import type { Anchor } from "./types";

/** 块级元素选择器（与 extractCandidateBlocks 保持一致）。 */
const BLOCK_SELECTOR = "p, h2, h3, h4, h5, li, pre, blockquote";

/**
 * 不可批注容器选择器：命中即拒绝批注。
 *
 * 这些块的渲染产物是矢量图/排版结构/可编辑代码，无稳定可寻址文本流：
 * - `pre`：围栏代码块（shiki 输出 pre.shiki、降级 pre、图块错误态的源码 pre）。
 * - `.katex-display`：块级公式 KaTeX display 产物（外层 div 已无 data-type，认渲染产物更鲁棒）
 * - `.cm-editor`：可运行代码块 CodeMirror 6（防御；当前其外层 div 已不命中 BLOCK_SELECTOR）
 * - `[data-type="diagram-block"]`、`[data-type="block-math"]`：防御性，防组件实现把
 *   data-type 保留到 DOM 时漏网
 */
const UNANNOTATABLE_SELECTOR =
	"pre, .katex-display, .cm-editor, [data-type='diagram-block'], [data-type='block-math']";

/**
 * 判断选区是否落在不可批注容器内。
 *
 * 取选区起点（startContainer）向上 closest 查找 UNANNOTATABLE_SELECTOR。
 * 只查起点即可——这些容器都是块级隔离的，选区不可能"半在代码块半在段落"，
 * 起点在内则整段选区都在内。
 */
export function isSelectionInUnannotatableContainer(range: Range): boolean {
	let node: Node | null = range.startContainer;
	while (node && node.nodeType !== Node.ELEMENT_NODE) {
		node = node.parentNode;
	}
	return (node as HTMLElement | null)?.closest(UNANNOTATABLE_SELECTOR) != null;
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

/**
 * 算「块首 → 选区端点」之间的文本长度（即块内字符 offset）。
 * 用 Range.toString().length 把 DOM 节点级 offset 转块文本级 offset。
 */
function offsetWithinBlock(blockEl: HTMLElement, endNode: Node, endOffset: number): number {
	const range = document.createRange();
	range.setStart(blockEl, 0);
	try {
		range.setEnd(endNode, endOffset);
	} catch {
		// endNode 不在 blockEl 内（跨块），返回 -1 表示无效
		return -1;
	}
	return range.toString().length;
}

export interface SelectionToAnchorOptions {
	/** 选区所在正文容器（用于校验选区在正文内） */
	root: HTMLElement;
}

/**
 * selectionToAnchor 从当前 Selection 提取 Anchor。
 *
 * @returns Anchor 五元组；跨块/选区无效/选区在正文外 → null
 */
export async function selectionToAnchor(opts: SelectionToAnchorOptions): Promise<Anchor | null> {
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

	const range = selection.getRangeAt(0);

	// 不可批注容器（代码块/图块/块级公式）→ 拒绝，返回 null 让 FloatingToolbar 隐藏
	if (isSelectionInUnannotatableContainer(range)) return null;

	const startBlock = findClosestBlock(range.startContainer);
	const endBlock = findClosestBlock(range.endContainer);
	if (!startBlock || !endBlock) return null;

	// 选区必须在正文容器内
	if (!opts.root.contains(startBlock) || !opts.root.contains(endBlock)) return null;

	// 跨块判定：起点和终点所在块不同 → null
	if (startBlock !== endBlock) return null;

	const blockText = getBlockText(startBlock);
	const blockId = await computeBlockId(blockText);
	if (blockId === null) return null;

	// 算块内 startOffset / endOffset
	const startOffset = offsetWithinBlock(startBlock, range.startContainer, range.startOffset);
	const endOffset = offsetWithinBlock(startBlock, range.endContainer, range.endOffset);
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
