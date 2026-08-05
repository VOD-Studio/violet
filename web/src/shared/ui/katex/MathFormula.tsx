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
import { useMemo } from "react";
import "katex/dist/katex.min.css";
import { renderKatexElement } from "./katex-element";

/** 行内公式（段落文字流内） */
export function InlineMathFormula({ latex }: { latex: string }) {
	const node = useMemo(() => renderKatexElement(latex, false), [latex]);
	return <span>{node}</span>;
}

/** 公式块（独立成段，可横向滚动防溢出） */
export function BlockMathFormula({ latex }: { latex: string }) {
	const node = useMemo(() => renderKatexElement(latex, true), [latex]);
	return <div className="my-6 overflow-x-auto">{node}</div>;
}
