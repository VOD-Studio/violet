import href from "katex/dist/katex.min.css?url";

/**
 * KaTeX 排版样式。
 *
 * @remarks React 把带 precedence 的样式表提升进 head 并去重；服务端渲染出的公式与样式同一帧送达，
 * 禁用 JavaScript 时也能正确排版，不会把 MathML 注解层与排版层同时露出来。
 */
export function KatexStylesheet() {
	return <link rel="stylesheet" href={href} precedence="katex" />;
}
