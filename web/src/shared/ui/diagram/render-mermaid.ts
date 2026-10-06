/**
 * Mermaid 负责语义与布局，净化后的 SVG 统一使用手写字体与 Rough.js 笔触。
 * strict 初始化与 DOMPurify 二次清理共同阻断图表源码中的可执行内容。
 *
 * 失败（语法错 / 渲染异常）返回 { error }，不抛出——阅读端据此走降级占位。
 */
import DOMPurify, { type Config } from "dompurify";
import { DIAGRAM_FONT_FAMILY, loadDiagramFonts } from "./sketch-fonts";
import { sketchSvg } from "./sketch-svg";
import { getThemeVariables, type MermaidThemeVariables } from "./theme-variables";

export type DiagramTheme = "light" | "dark";

export type RenderMermaidResult = { svg: string } | { error: string };

/**
 * SVG 默认使用原生文字；作者启用 HTML 标签时仍保留安全文本与布局元素。
 * foreignObject 是 HTML integration point，须显式声明才能保留其内部标签。
 * style 属性由全局 hook 清理；脚本、导航链接与事件属性不进入最终 SVG。
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

function centerCircularLabels(svg: SVGSVGElement): void {
	for (const circle of svg.querySelectorAll<SVGCircleElement>("circle.label-container")) {
		const label = circle.parentElement?.querySelector<SVGGElement>(":scope > .label");
		if (!label || label.querySelector("foreignObject")) continue;
		const transform = label.transform.baseVal.consolidate();
		if (!transform) continue;
		const box = label.getBBox();
		const x = box.x + box.width / 2;
		const y = box.y + box.height / 2;
		const matrix = transform.matrix;
		// Mermaid 的圆形 SVG 标签仍沿用 HTML 标签锚点，需按实际字框居中。
		matrix.e = circle.cx.baseVal.value - matrix.a * x - matrix.c * y;
		matrix.f = circle.cy.baseVal.value - matrix.b * x - matrix.d * y;
		label.transform.baseVal.initialize(svg.createSVGTransformFromMatrix(matrix));
	}
}

/**
 * 将 Mermaid 源码渲染为净化后的手绘 SVG；宽图保留自然字号供容器横向滚动。
 *
 * @param source Mermaid 源码；图内指令的渲染产物仍经 DOMPurify 清理
 * @param theme 决定图表配色，不依赖页面当前明暗模式
 * @returns 成功返回 SVG，失败返回可供界面展示的错误信息
 */
export async function renderMermaid(
	source: string,
	theme: DiagramTheme = "light",
): Promise<RenderMermaidResult> {
	try {
		const mermaid = await loadMermaid();
		await loadDiagramFonts(source);
		const themeVariables: MermaidThemeVariables = getThemeVariables(theme === "dark");
		mermaid.initialize({
			startOnLoad: false,
			securityLevel: "strict",
			look: "classic",
			htmlLabels: false,
			fontFamily: DIAGRAM_FONT_FAMILY,
			altFontFamily: DIAGRAM_FONT_FAMILY,
			themeCSS: `text, tspan, foreignObject, foreignObject * { font-family: ${DIAGRAM_FONT_FAMILY} !important; }`,
			sequence: {
				actorFontFamily: DIAGRAM_FONT_FAMILY,
				messageFontFamily: DIAGRAM_FONT_FAMILY,
				noteFontFamily: DIAGRAM_FONT_FAMILY,
			},
			journey: {
				taskFontFamily: DIAGRAM_FONT_FAMILY,
				titleFontFamily: DIAGRAM_FONT_FAMILY,
				textPlacement: "svg",
			},
			theme: theme === "dark" ? "dark" : "base",
			themeVariables,
			// 禁止 Mermaid 将解析错误画成挂在页面底部的 errorDiagram。
			suppressErrorRendering: true,
		});
		const id = `diagram-render-${crypto.randomUUID()}`;
		// opacity 不影响图内 visibility 判定；离屏容器仍可用于字体与 SVG 测量。
		const container = document.createElement("div");
		container.style.cssText =
			"position:absolute;left:-9999px;top:0;width:920px;opacity:0;pointer-events:none;";
		container.setAttribute("aria-hidden", "true");
		document.body.appendChild(container);
		try {
			const { svg } = await mermaid.render(id, source, container);
			container.innerHTML = DOMPurify.sanitize(svg, SANITIZE_CONFIG) as string;
			const root = container.querySelector("svg");
			if (!root) throw new Error("图表渲染未生成 SVG");
			centerCircularLabels(root);
			sketchSvg(root);
			const viewBox = root.getAttribute("viewBox")?.trim().split(/\s+/).map(Number);
			if (viewBox?.length === 4) {
				const [x, y, width, height] = viewBox;
				// 为不规则笔触保留边缘，避免 SVG 视口裁掉轮廓。
				root.setAttribute("viewBox", `${x - 6} ${y - 6} ${width + 12} ${height + 12}`);
				root.setAttribute("width", String(width + 12));
				root.setAttribute("height", String(height + 12));
			}
			root.style.maxWidth = "none";
			root.style.flexShrink = "0";
			return { svg: root.outerHTML };
		} finally {
			// Mermaid 只回收内层临时节点，外层测量容器由调用方回收。
			container.remove();
		}
	} catch (error) {
		return { error: error instanceof Error ? error.message : String(error) };
	}
}
