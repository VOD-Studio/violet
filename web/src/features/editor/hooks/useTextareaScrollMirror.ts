/**
 * textarea 滚动镜像 hook。
 *
 * 源码模式下 textarea 是 `white-space: pre-wrap` 自动换行,一行
 * Markdown 可能跨多视觉行。要在「行号 ↔ scrollTop」间精确换算,
 * 必须复刻 textarea 的换行规则——用一个隐藏的镜像 div 克隆其
 * box-model(字体/padding/width/white-space),量 div 的 scrollHeight。
 *
 * 行号↔字符 offset 的换算本身是纯函数,可单测;镜像 div 的 DOM
 * 操作是薄包装(真实浏览器精确,jsdom 下布局不可信不深测)。
 */

import { useCallback, useEffect, useRef } from "react";

/** 第 N 行(0 基)在文本中的起始字符 offset */
export function lineToCharOffset(text: string, line: number): number {
	if (line <= 0) return 0;
	let current = 0;
	let offset = 0;
	while (current < line && offset < text.length) {
		const next = text.indexOf("\n", offset);
		if (next === -1) return text.length;
		offset = next + 1;
		current++;
	}
	return Math.min(offset, text.length);
}

/** 字符 offset 落在第几行(0 基) */
export function charOffsetToLine(text: string, offset: number): number {
	if (offset <= 0) return 0;
	const clamped = Math.min(offset, text.length);
	let line = 0;
	for (let i = 0; i < clamped; i++) {
		if (text.charCodeAt(i) === 0x0a) line++;
	}
	return line;
}

interface MirrorContext {
	el: HTMLTextAreaElement;
	mirror: HTMLDivElement;
}

/**
 * 为目标 textarea 创建镜像 div,克隆其影响换行的 computed style。
 * 返回清理函数。镜像挂在 textarea 父节点上(absolute/visibility:hidden),
 * 宽度同步跟随 textarea resize/容器宽度变化。
 */
function createMirror(textarea: HTMLTextAreaElement): MirrorContext {
	const mirror = document.createElement("div");
	mirror.setAttribute("aria-hidden", "true");
	mirror.style.position = "absolute";
	mirror.style.visibility = "hidden";
	mirror.style.whiteSpace = "pre-wrap";
	mirror.style.wordWrap = "break-word";
	mirror.style.overflow = "hidden";
	mirror.style.pointerEvents = "none";

	syncMirrorStyle(textarea, mirror);

	// 镜像挂到 textarea 父节点;父节点若无定位上下文,镜像也无所谓
	// (visibility:hidden + 绝对定位,不影响布局)
	const parent = textarea.parentElement ?? document.body;
	parent.appendChild(mirror);

	return { el: textarea, mirror };
}

/** 从 textarea 读 box-model 写到镜像(字体/padding/宽/border) */
function syncMirrorStyle(source: HTMLTextAreaElement, mirror: HTMLDivElement): void {
	const cs = window.getComputedStyle(source);
	const copy = [
		"fontFamily",
		"fontSize",
		"fontWeight",
		"fontStyle",
		"letterSpacing",
		"lineHeight",
		"paddingTop",
		"paddingRight",
		"paddingBottom",
		"paddingLeft",
		"borderTopWidth",
		"borderRightWidth",
		"borderBottomWidth",
		"borderLeftWidth",
		"boxSizing",
		"textTransform",
		"tabSize",
	] as const;
	for (const prop of copy) {
		mirror.style.setProperty(
			prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`),
			cs[prop],
		);
	}
	mirror.style.width = `${source.clientWidth}px`;
}

/** 写入文本前缀后,镜像的 scrollHeight 即该前缀末尾对应的滚动高度 */
function measureHeightAtPrefix(ctx: MirrorContext, prefix: string): number {
	// 末尾补一个零宽空格,确保末行(空行或 trailing newline)也被计入
	ctx.mirror.textContent = `${prefix}\u200b`;
	const height = ctx.mirror.scrollHeight;
	// 量完即清空：镜像文本残留会把镜像撑到对应高度（absolute 元素），
	// 在无定位祖先时包含块是 initial containing block，会撑开页面产生滚动条。
	ctx.mirror.textContent = "";
	return height;
}

export interface TextareaScrollMirror {
	/** 把 textarea 滚动到第 N 行(0 基)顶部 */
	scrollToLine: (line: number) => void;
	/** 取 textarea 当前 scrollTop 对应的行号(0 基) */
	getLineAtScrollTop: () => number;
}

/**
 * 为 textarea ref 提供行号↔滚动位置的换算。
 *
 * hook 在 textarea mount 后创建镜像,卸载时清理。调用方拿到
 * `scrollToLine` / `getLineAtScrollTop` 在切换前后调用。镜像随
 * textarea 的 box-model 变化重新同步(ResizeObserver)。
 */
export function useTextareaScrollMirror(
	textareaRef: React.RefObject<HTMLTextAreaElement | null>,
): TextareaScrollMirror {
	const ctxRef = useRef<MirrorContext | null>(null);

	const ensureMirror = useCallback((): MirrorContext | null => {
		const el = textareaRef.current;
		if (!el) return null;
		if (!ctxRef.current || ctxRef.current.el !== el) {
			ctxRef.current?.mirror.remove();
			ctxRef.current = createMirror(el);
		}
		syncMirrorStyle(el, ctxRef.current.mirror);
		return ctxRef.current;
	}, [textareaRef]);

	// 卸载清理
	useEffect(() => {
		return () => {
			ctxRef.current?.mirror.remove();
			ctxRef.current = null;
		};
	}, []);

	const scrollToLine = useCallback(
		(line: number) => {
			const ctx = ensureMirror();
			const el = textareaRef.current;
			if (!ctx || !el) return;
			const offset = lineToCharOffset(el.value, line);
			el.scrollTop = measureHeightAtPrefix(ctx, el.value.slice(0, offset));
		},
		[ensureMirror, textareaRef],
	);

	const getLineAtScrollTop = useCallback((): number => {
		const ctx = ensureMirror();
		const el = textareaRef.current;
		if (!ctx || !el) return 0;
		const target = el.scrollTop;
		// 二分字符 offset,找镜像 scrollHeight 首次超过 target 的位置
		const total = el.value.length;
		let lo = 0;
		let hi = total;
		let result = 0;
		while (lo <= hi) {
			const mid = (lo + hi) >> 1;
			const h = measureHeightAtPrefix(ctx, el.value.slice(0, mid));
			if (h <= target) {
				result = mid;
				lo = mid + 1;
			} else {
				hi = mid - 1;
			}
		}
		return charOffsetToLine(el.value, result);
	}, [ensureMirror, textareaRef]);

	return { scrollToLine, getLineAtScrollTop };
}
