/**
 * extract-blocks —— 从正文 DOM 提取候选块列表（relocate 的输入）。
 *
 * 遍历 [data-article-content] 容器内的块级元素（p/h2/h3/h4/li/pre/blockquote），
 * 对每个取 textContent 调 computeBlockId 算 id，组装 CandidateBlock[]。
 *
 * 这是「DOM → relocate 输入」的桥接，让 relocate 纯函数不碰 DOM。
 */

import { computeBlockId } from "./block-id";
import type { CandidateBlock } from "./relocate";

/** 块级元素选择器：批注可锚定的元素类型。 */
const BLOCK_SELECTOR = "p, h2, h3, h4, h5, li, pre, blockquote";

/** 角标 class——计算 blockId 时需排除角标的 textContent（SVG <text> 含数字会污染哈希）。 */
const MARKER_CLASS = "annotation-marker-inline";

/**
 * getBlockText 读取块的纯文本，排除已注入的批注角标。
 *
 * 角标 SVG 内的 <text> 元素含计数字符（如 "1"、"99+"），
 * 会让 computeBlockId 在角标注入前后算出不同哈希，破坏 block_id 一致性。
 */
export function getBlockText(el: HTMLElement): string {
	if (!el.querySelector(`.${MARKER_CLASS}`)) {
		return el.textContent ?? "";
	}
	const clone = el.cloneNode(true) as HTMLElement;
	clone.querySelectorAll(`.${MARKER_CLASS}`).forEach((m) => {
		m.remove();
	});
	return clone.textContent ?? "";
}

/**
 * extractCandidateBlocks 从正文容器提取候选块列表。
 *
 * @param root 正文容器元素（通常是 [data-article-content] 的 <main>）
 * @returns 候选块数组；空块（纯空白）会被 computeBlockId 过滤（返回 null）
 */
export async function extractCandidateBlocks(root: HTMLElement): Promise<CandidateBlock[]> {
	const elements = Array.from(root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR));
	const blocks: CandidateBlock[] = [];

	for (const el of elements) {
		const text = getBlockText(el);
		const id = await computeBlockId(text);
		if (id !== null) {
			blocks.push({ id, text });
		}
	}
	return blocks;
}

/**
 * 找到 blockId 对应的 DOM 元素（用于滚动定位）。
 * 重新遍历算 id 匹配——DOM 没有 data-block-id 属性，靠文本 hash 定位。
 */
export async function findBlockElement(
	root: HTMLElement,
	blockId: string,
): Promise<HTMLElement | null> {
	const elements = Array.from(root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR));
	for (const el of elements) {
		const text = getBlockText(el);
		const id = await computeBlockId(text);
		if (id === blockId) return el;
	}
	return null;
}
