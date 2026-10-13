/**
 * extract-blocks —— 从正文 DOM 提取候选块列表（relocate 的输入）。
 *
 * 遍历 [data-article-content] 容器内的块级元素（p/h2/h3/h4/li/pre/blockquote），
 * 对每个取 getBlockText 调 computeBlockId 算 id，组装 CandidateBlock[]。
 *
 * getBlockText 对语义 carrier（inline-math / runnable data-source）与阅读端
 * HtmlContent 渲染口径对齐，供 MCP 服务端 ExtractArticleBlocks 同源校验。
 * findBlockElement / extract 另算 legacy textContent hash，兼容历史公式批注。
 */

import { computeBlockId } from "./block-id";
import type { CandidateBlock } from "./relocate";

/** 块级元素选择器：批注可锚定的元素类型。 */
const BLOCK_SELECTOR = "p, h2, h3, h4, h5, li, pre, blockquote, [data-runnable='true']";

/**
 * getBlockText 读取块的纯文本，是 computeBlockId 与选区锚点共用的取文本口径。
 * 可运行块优先 data-source；行内/块公式用 data-latex（避免 KaTeX DOM 与空 carrier 不一致）。
 */
export function getBlockText(el: HTMLElement): string {
	if (el.dataset.runnable === "true" && el.dataset.source != null && el.dataset.source !== "") {
		return el.dataset.source;
	}
	return carrierAwareTextContent(el);
}

/** 旧口径：DOM textContent（含 KaTeX 渲染文本），仅用于历史锚点 hash 回退。 */
export function getLegacyBlockText(el: HTMLElement): string {
	return el.textContent ?? "";
}

/** 与 getBlockText 相同的 carrier 口径，可用于 DocumentFragment（选区前缀测长）。 */
export function measureCarrierText(root: Node): string {
	return carrierAwareTextContent(root);
}

function carrierAwareTextContent(root: Node): string {
	const parts: string[] = [];
	const walk = (node: Node) => {
		if (node.nodeType === Node.ELEMENT_NODE) {
			const el = node as HTMLElement;
			const dataType = el.getAttribute("data-type");
			if (dataType === "inline-math" || dataType === "block-math") {
				parts.push(el.getAttribute("data-latex") ?? "");
				return;
			}
			if (dataType === "diagram-block") {
				parts.push(el.getAttribute("data-source") ?? "");
				return;
			}
			if (el.dataset.runnable === "true" && el.dataset.source) {
				parts.push(el.dataset.source);
				return;
			}
		}
		if (node.nodeType === Node.TEXT_NODE) {
			parts.push(node.textContent ?? "");
			return;
		}
		for (const child of Array.from(node.childNodes)) {
			walk(child);
		}
	};
	walk(root);
	return parts.join("");
}

async function legacyIdIfDifferent(
	canonicalText: string,
	el: HTMLElement,
): Promise<string | undefined> {
	const legacyText = getLegacyBlockText(el);
	if (legacyText.trim() === "" || legacyText === canonicalText) return undefined;
	const legacyId = await computeBlockId(legacyText);
	const canonicalId = await computeBlockId(canonicalText);
	if (legacyId === null || legacyId === canonicalId) return undefined;
	return legacyId;
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
			const legacyId = await legacyIdIfDifferent(text, el);
			blocks.push(legacyId !== undefined ? { id, text, legacyId } : { id, text });
		}
	}
	return blocks;
}

/**
 * 找到 blockId 对应的 DOM 元素（用于滚动定位）。
 * 先匹配现行 carrier hash，再回退旧 textContent hash（历史公式批注）。
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
		const legacyId = await legacyIdIfDifferent(text, el);
		if (legacyId === blockId) return el;
	}
	return null;
}
