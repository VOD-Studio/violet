import { useEffect } from "react";

/** 选区笔触落在文字所属的块上；td/th 也算块，表格内的选区同样有笔触 */
const BLOCK_SELECTOR = "p, h2, h3, h4, h5, li, pre, blockquote, td, th";
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

function paint(block: HTMLElement, strokes: Stroke[]): void {
	const images = strokes.map((_, i) => `var(--annotation-select-${i % 2 === 0 ? "a" : "b"})`);
	block.style.setProperty("background-image", images.join(","));
	block.style.setProperty(
		"background-size",
		strokes.map((s) => `${s.width}px ${s.height}px`).join(","),
	);
	block.style.setProperty(
		"background-position",
		strokes.map((s) => `${s.x}px ${s.y}px`).join(","),
	);
	block.style.setProperty("background-repeat", "no-repeat");
}

function clear(block: HTMLElement): void {
	for (const prop of BG_PROPS) block.style.removeProperty(prop);
}

export interface SelectionHighlightProps {
	/** 正文容器 ref：只为落在其中的选区画笔触 */
	contentRef: React.RefObject<HTMLElement | null>;
}

/**
 * SelectionHighlight - 拖选文字时的荧光笔笔触。
 *
 * 原生选区和 CSS Custom Highlight API 都只能画直角色块，做不出手绘形状；这里把选区每一行的
 * 笔触画成所在块的背景图层（坐标相对块自身），笔触在文字下方、随正文滚动，不是浮在页面上的覆盖层。
 * 与已保存划线（绿色）、草稿划线（琥珀色）同款手绘形状而颜色更淡。
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
