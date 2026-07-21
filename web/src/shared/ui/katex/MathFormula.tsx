/**
 * MathFormula - 阅读端公式渲染组件（浏览时渲染）
 *
 * HtmlContent（hast 管线）与 MarkdownContent（react-markdown 降级）共用，
 * 经 markdownComponents 懒加载引入——KaTeX + 字体只在含公式的文章页拉取。
 * CSS 在本模块静态导入，Vite 随异步 chunk 拆分。
 */
import { useMemo } from "react";
import "katex/dist/katex.min.css";
import { renderKatex } from "./katex-core";

/** 行内公式（段落文字流内） */
export function InlineMathFormula({ latex }: { latex: string }) {
    const html = useMemo(() => renderKatex(latex, false), [latex]);
    // 来源是受信后台编辑器产出的 data-latex，KaTeX 输出本身安全（无 script）
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

/** 公式块（独立成段，可横向滚动防溢出） */
export function BlockMathFormula({ latex }: { latex: string }) {
    const html = useMemo(() => renderKatex(latex, true), [latex]);
    return <div className="my-6 overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />;
}
