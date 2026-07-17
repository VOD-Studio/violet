/**
 * markdown barrel - 聚合 markdown 处理能力
 *
 * 注意：toc（轻量）与 render（含 highlight.js/marked，重）分属独立模块。
 * 只需提取目录的消费者应直引 @shared/lib/markdown/toc，避免拉入 render 的重依赖。
 */

export { markdownToHtml } from "./render";
export type { TocItem } from "./toc";
export { extractMarkdownToc } from "./toc";
