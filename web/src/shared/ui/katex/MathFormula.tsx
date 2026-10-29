/**
 * MathFormula - 阅读端公式渲染组件（浏览时渲染）
 *
 * HtmlContent（hast 管线）与 MarkdownContent（react-markdown 降级）共用，
 * 经 markdownComponents 懒加载引入——KaTeX + 字体只在含公式的文章页拉取。
 * CSS 在本模块静态导入，Vite 随异步 chunk 拆分。
 *
 * 渲染走 katex-element 白名单管线（hast sanitize → React 元素），
 * 不经 dangerouslySetInnerHTML（ADR-0005）。
 */
import { scheduleEnhancement } from "@shared/lib/schedule-enhancement";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import "katex/dist/katex.min.css";
import { renderKatexElement } from "./katex-element";

/**
 * 在段落文字流内同步排版公式，由 InlineMathContent 提供唯一语义载体。
 *
 * @remarks 相同源码复用当前实例的排版结果；不再嵌套 data-latex 载体，
 * 以便批注选区始终吸附到完整公式边界。
 */
export function InlineMathFormula({ latex }: { latex: string }) {
	return useMemo(() => renderKatexElement(latex, false), [latex]);
}

/**
 * 保留 LaTeX 原文的块公式，接管后按共享队列计算排版。
 *
 * @remarks 同一源码在挂载期间保留结果；源码变化或卸载取消尚未开始的计算。
 * SSR、计算尚未完成或失败时显示原文；视口门控由调用方在加载本模块前完成。
 */
export function BlockMathFormula({ latex }: { latex: string }) {
	const hostRef = useRef<HTMLDivElement>(null);
	const [rendered, setRendered] = useState<{ latex: string; node: ReactNode } | null>(null);
	useEffect(() => {
		const controller = new AbortController();
		void scheduleEnhancement(() => renderKatexElement(latex, true), {
			element: hostRef.current,
			signal: controller.signal,
		})
			.then((node) => {
				if (!controller.signal.aborted) setRendered({ latex, node });
			})
			.catch(() => {
				// 无法计算时保留 LaTeX 原文，保持与无 JavaScript 时相同的可读降级。
			});
		return () => controller.abort();
	}, [latex]);
	return (
		<div
			ref={hostRef}
			className="my-6 overflow-x-auto"
			data-type="block-math"
			data-latex={latex}
		>
			{rendered?.latex === latex ? rendered.node : latex}
		</div>
	);
}
