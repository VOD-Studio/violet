/**
 * renderMermaid - mermaid 单图渲染（含 DOMPurify 双重防线）
 *
 * 动态 import mermaid → securityLevel:strict 初始化 → render 拿 SVG →
 * DOMPurify 二次清理。strict 是第一道防线（挡常规注入），DOMPurify 是第二道
 * 兜底——mermaid 支持 per-diagram `%%{init: {securityLevel: "loose"}}%%` 指令
 * 覆盖全局 strict（docmost CVE-2026-23630 / GHSA-r4hj-mc62-jmwj 的存储型 XSS
 * 攻击路径），第二道 DOMPurify 剥掉渲染产物里的 script、a、img、on* 事件属性
 * 等可执行/可导航内容，确保即使 strict 被绕过也无法落盘可执行 SVG。
 *
 * 失败（语法错 / 渲染异常）返回 { error }，不抛出——阅读端据此走降级占位。
 */
import DOMPurify, { type Config } from "dompurify";
import { getThemeVariables, type MermaidThemeVariables } from "./theme-variables";

export type DiagramTheme = "light" | "dark";

export type RenderMermaidResult = { svg: string } | { error: string };

/**
 * DOMPurify 清理配置：SVG 子集 + foreignObject 内纯文本 HTML 白名单
 *
 * - USE_PROFILES svg/svgFilters：只放行 SVG 元素子集
 * - foreignObject 是 mermaid v11 渲染节点文字的载体（flowchart/classDiagram/
 *   stateDiagram/erDiagram/mindmap 的文字都在 <foreignObject><div><span><p>
 *   结构里），svg profile 默认连 foreignObject 一起剥掉导致这些图文字全丢，
 *   故显式放行 foreignObject 及其内部的纯布局/文本标签（div/span/p/br/b/i/
 *   em/strong/code/pre/ul/ol/li）——这些标签没有 href/src/事件属性，无执行能力
 * - foreignObject 是 HTML 规范定义的 HTML integration point（其内容按 HTML
 *   解析），DOMPurify 默认列表只含 annotation-xml，须经 HTML_INTEGRATION_POINTS
 *   声明，否则 foreignObject 内的 div/span/p 被命名空间检查拒绝
 * - FORBID_TAGS script/a：script 默认已剥但钉死防漂移；a 在 svg profile 白名单
 *   里（SVG <a> 可导航），节点 label 里写了链接宁可剥成纯文本
 * - img/iframe/body 等不在任何白名单，标签被剥留文本（DOMPurify 默认策略）
 * - ADD_ATTR class/style：mermaid label 布局依赖（table-cell 居中、white-space、
 *   max-width）；style 值由下方全局 hook 清洗（剥 url()/@import 等函数与 @ 规则）
 * - on* 事件属性：不在 DOMPurify 任何 allow list 中，默认即被剥除（无需列举）
 */
const SANITIZE_CONFIG: Config = {
	USE_PROFILES: { svg: true, svgFilters: true },
	FORBID_TAGS: ["script", "a"],
	ADD_TAGS: [
		"style",
		"foreignObject",
		"div",
		"span",
		"p",
		"br",
		"b",
		"i",
		"em",
		"strong",
		"code",
		"pre",
		"ul",
		"ol",
		"li",
	],
	ADD_ATTR: ["class", "style"],
	HTML_INTEGRATION_POINTS: { "annotation-xml": true, foreignobject: true },
};

/**
 * style 属性值清洗：剥掉 CSS 函数调用（url()/expression()/attr() 等）与
 * @ 规则（@import/@charset）及 IE 专属危险属性（behavior/-moz-binding）。
 *
 * DOMPurify 3.x 把 style 列入 URI_SAFE_ATTRIBUTES 直接放行、不做 CSS 清洗，
 * 且 hooks 只能经全局 addHook 注册（config 里的 uponSanitizeAttribute 被忽略）。
 * mermaid 自身生成的 style 只含纯属性值对（display/white-space/max-width/
 * text-align...），清洗只影响注入者写的 url()/@import 等内容。
 */
const STYLE_FUNCTION_CALL_RE =
	/(?:url|expression|attr|image|cross-fade|element|progid|format)\s*\([^)]*\)/gi;
const STYLE_AT_RULE_RE = /@(?:import|charset|namespace)[^;]*;?/gi;
const STYLE_DANGEROUS_PROP_RE = /(?:^|;)\s*(?:behavior|-moz-binding)\s*:[^;]*/gi;

function sanitizeStyleValue(value: string): string {
	return value
		.replace(STYLE_FUNCTION_CALL_RE, "")
		.replace(STYLE_AT_RULE_RE, "")
		.replace(STYLE_DANGEROUS_PROP_RE, ";");
}

// 全局注册一次（DOMPurify hooks 不走 config）；项目内 DOMPurify 仅本模块使用，
// 不影响其他清理路径（文章 HTML 走 hast-util-sanitize 白名单）。
DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
	if (data.attrName === "style") {
		data.attrValue = sanitizeStyleValue(data.attrValue);
	}
});

/** mermaid 模块缓存：首次渲染才动态 import（懒加载，不含图块的文章页不付体积） */
let mermaidLoader: Promise<typeof import("mermaid").default> | null = null;

async function loadMermaid(): Promise<typeof import("mermaid").default> {
	if (!mermaidLoader) {
		mermaidLoader = import("mermaid").then((m) => m.default);
	}
	return mermaidLoader;
}

/** 渲染实例自增 id，保证多次调用互不撞 id */
let renderSeq = 0;

/**
 * renderMermaid - 渲染 mermaid 源码为经 DOMPurify 清理的 SVG 字符串
 *
 * @param source mermaid 源码（可能含恶意 %%{init}%% 指令——由 DOMPurify 兜底）
 * @param theme  'light' | 'dark'，决定 themeVariables 明暗（默认 light）
 * @returns 成功 { svg }（已清理），失败 { error }（错误信息字符串）
 */
export async function renderMermaid(
	source: string,
	theme: DiagramTheme = "light",
): Promise<RenderMermaidResult> {
	try {
		const mermaid = await loadMermaid();
		const themeVariables: MermaidThemeVariables = getThemeVariables(theme === "dark");
		mermaid.initialize({
			startOnLoad: false,
			securityLevel: "strict",
			// 明暗双主题：dark 用内置主题（深色节点 + 浅字全图配对），
			// light 用 base + 站点框架色（保留默认彩色节点）
			theme: theme === "dark" ? "dark" : "base",
			themeVariables,
			// suppressErrorRendering: true — mermaid v11 默认 false，解析失败时不抛错，
			// 而是路由到内置 errorDiagram 把含 "Syntax error in text" + "mermaid version"
			// 的错误图画进挂在 document.body 的临时 div，事后虽会 throw，但 throw 前不
			// 清理该临时 div → 残留在页面底部（mermaid.esm.mjs:1670-1679 / 1718-1719）。
			// 我们有自己的 DiagramError 占位降级，要 mermaid 在画错误图之前就抛错，
			// 由下方 try/catch 捕获返回 { error }。
			suppressErrorRendering: true,
		});
		const id = `diagram-render-${++renderSeq}`;
		const { svg } = await mermaid.render(id, source);
		return { svg: DOMPurify.sanitize(svg, SANITIZE_CONFIG) as string };
	} catch (error) {
		return { error: error instanceof Error ? error.message : String(error) };
	}
}
