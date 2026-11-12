import { type RefObject, useLayoutEffect, useState } from "react";

/** 行数判定的余量：超过一行半才算换行，避开行高与内边距的取整误差。 */
const WRAP_THRESHOLD_LINES = 1.5;

export interface FieldWrappedOptions {
	/** 可编辑区 */
	editorRef: RefObject<HTMLElement | null>;
	/** 与文字同行时排在两侧的容器；它们的宽度是同行时文字让出的空间 */
	sideRefs: readonly RefObject<HTMLElement | null>[];
	/** 文字内容，变化时重新判断 */
	content: string;
	/** 非字段布局不测量 */
	enabled: boolean;
}

/**
 * 判断字段里的文字与两侧图标钮同行时是否已写不下一行，供布局把图标钮挪到文字下方、文字占满整行。
 *
 * @returns 文字按同行宽度排版是否超过一行
 * @remarks 始终按同行时的可用宽度判断：文字独占整行后变回一行，不会把图标钮收回同行又再次挤换行。
 * 无布局的环境（服务端、jsdom）恒为 false。
 */
export function useFieldWrapped({
	editorRef,
	sideRefs,
	content,
	enabled,
}: FieldWrappedOptions): boolean {
	const [wrapped, setWrapped] = useState(false);
	// biome-ignore lint/correctness/useExhaustiveDependencies: content 不在回调里读取，但文字一变就要重新测量
	useLayoutEffect(() => {
		const editor = editorRef.current;
		if (!enabled || !editor) return;
		const measure = () => {
			const style = getComputedStyle(editor);
			const lineHeight = Number.parseFloat(style.lineHeight);
			if (!(lineHeight > 0)) return;
			const paddingBlock =
				Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
			const lines = (editor.scrollHeight - paddingBlock) / lineHeight;
			if (lines > WRAP_THRESHOLD_LINES) {
				setWrapped(true);
				return;
			}
			setWrapped((current) => {
				if (!current) return false;
				// 独占整行时只有一行：按图标钮回到同行后剩下的宽度，看这一行还放不放得下
				const range = document.createRange();
				range.selectNodeContents(editor);
				const row = editor.parentElement;
				const gap = row ? Number.parseFloat(getComputedStyle(row).columnGap) || 0 : 0;
				const reserved = sideRefs.reduce(
					(total, side) => total + (side.current?.offsetWidth ?? 0) + gap,
					0,
				);
				const paddingInline =
					Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
				return (
					range.getBoundingClientRect().width >
					editor.clientWidth - paddingInline - reserved
				);
			});
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(editor);
		return () => observer.disconnect();
	}, [editorRef, sideRefs, content, enabled]);
	return wrapped;
}
