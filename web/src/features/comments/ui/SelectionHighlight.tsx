import { useEffect } from "react";

/** 选区笔触落在文字所属的最近块上；td/th/div 等也算块，避免这些位置的选区没有任何底色 */
const BLOCK_SELECTOR = "p, h2, h3, h4, h5, li, pre, blockquote, td, th, div, figcaption, summary";
/** 笔触比文字行框略宽，两端留出一点呼吸，px */
const BLEED_PX = 3;
/** 写在块 inline style 上的背景属性，清理时逐个移除 */
const BG_PROPS = [
	"background-image",
	"background-size",
	"background-position",
	"background-repeat",
];

interface Stroke {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** 按块归并选区每个文本节点的行矩形，坐标换算成相对块 padding box 的偏移。 */
function strokesByBlock(range: Range, root: HTMLElement): Map<HTMLElement, Stroke[]> {
	const result = new Map<HTMLElement, Stroke[]>();
	const probe = document.createRange();
	const container = range.commonAncestorContainer;
	const nodes: Text[] = container.nodeType === Node.TEXT_NODE ? [container as Text] : [];
	const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
	for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text);

	for (const node of nodes) {
		if (!range.intersectsNode(node)) continue;
		const block = node.parentElement?.closest<HTMLElement>(BLOCK_SELECTOR);
		if (!block || !root.contains(block)) continue;
		probe.selectNodeContents(node);
		if (node === range.startContainer) probe.setStart(node, range.startOffset);
		if (node === range.endContainer) probe.setEnd(node, range.endOffset);

		const box = block.getBoundingClientRect();
		const originX = box.left + block.clientLeft;
		const originY = box.top + block.clientTop;
		for (const r of probe.getClientRects()) {
			if (r.width < 1 || r.height < 1) continue;
			const strokes = result.get(block) ?? [];
			strokes.push({
				x: r.left - originX - BLEED_PX,
				y: r.top - originY,
				width: r.width + BLEED_PX * 2,
				height: r.height,
			});
			result.set(block, strokes);
		}
	}
	return result;
}

/** 笔触两端圆头的固定宽度，px；只有中段随行宽拉伸，圆头才不会被拉成尖角 */
const CAP_PX = 7;

function paint(block: HTMLElement, strokes: Stroke[]): void {
	const images: string[] = [];
	const sizes: string[] = [];
	const positions: string[] = [];
	strokes.forEach((s, i) => {
		const v = i % 2 === 0 ? "a" : "b";
		const cap = Math.min(CAP_PX, s.width / 2);
		const mid = Math.max(0, s.width - 2 * cap);
		images.push(
			`var(--annotation-select-capl-${v})`,
			`var(--annotation-select-mid-${v})`,
			`var(--annotation-select-capr-${v})`,
		);
		sizes.push(
			`${cap}px ${s.height}px`,
			`${mid + 1}px ${s.height}px`,
			`${cap}px ${s.height}px`,
		);
		positions.push(
			`${s.x}px ${s.y}px`,
			`${s.x + cap}px ${s.y}px`,
			`${s.x + s.width - cap}px ${s.y}px`,
		);
	});
	block.style.setProperty("background-image", images.join(","));
	block.style.setProperty("background-size", sizes.join(","));
	block.style.setProperty("background-position", positions.join(","));
	block.style.setProperty("background-repeat", "no-repeat");
	block.setAttribute("data-selection-painted", "");
}

function clear(block: HTMLElement): void {
	for (const prop of BG_PROPS) block.style.removeProperty(prop);
	block.removeAttribute("data-selection-painted");
}

/** 选区笔触的绘制范围。 */
export interface SelectionHighlightProps {
	/** 正文容器 ref：只为落在其中的选区画笔触 */
	contentRef: React.RefObject<HTMLElement | null>;
}

/**
 * 在所属正文块背景中绘制选区笔触，不修改文字或原生 Range。
 *
 * @remarks 只有完成绘制的块才替代原生选区底色；清理时恢复原生底色，
 * 模块尚未下载或加载失败时仍能看见浏览器选区。
 */
export function SelectionHighlight({ contentRef }: SelectionHighlightProps) {
	useEffect(() => {
		const root = contentRef.current;
		if (!root) return;
		let touched = new Set<HTMLElement>();
		let frame = 0;

		const reset = () => {
			for (const block of touched) clear(block);
			touched = new Set();
		};
		const update = () => {
			frame = 0;
			reset();
			const selection = window.getSelection();
			if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
			const range = selection.getRangeAt(0);
			if (!root.contains(range.commonAncestorContainer)) return;
			for (const [block, strokes] of strokesByBlock(range, root)) {
				paint(block, strokes);
				touched.add(block);
			}
		};
		const schedule = () => {
			if (frame === 0) frame = requestAnimationFrame(update);
		};

		document.addEventListener("selectionchange", schedule);
		window.addEventListener("resize", schedule);
		const observer = new ResizeObserver(schedule);
		observer.observe(root);
		return () => {
			if (frame !== 0) cancelAnimationFrame(frame);
			document.removeEventListener("selectionchange", schedule);
			window.removeEventListener("resize", schedule);
			observer.disconnect();
			reset();
		};
	}, [contentRef]);

	return null;
}
