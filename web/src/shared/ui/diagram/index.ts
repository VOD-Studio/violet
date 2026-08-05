/**
 * diagram - 图块（流程图）共享渲染核心
 *
 * 编辑器（弹层预览）与阅读端（浏览时渲染）共用同一渲染管线，保证「写作所见
 * = 发布所渲染」。mermaid 大体积依赖仅在真含图块处经 React.lazy / 动态 import
 * 拉取（PRD 懒加载决策）。
 */

export { DiagramBlock, type DiagramBlockProps } from "./DiagramBlock";
export { type DiagramTheme, type RenderMermaidResult, renderMermaid } from "./render-mermaid";
export { type DiagramRenderer, diagramRenderers } from "./renderers";
export {
	cssColorToHex,
	getThemeVariables,
	type MermaidThemeVariables,
} from "./theme-variables";
