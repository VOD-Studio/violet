/**
 * Mermaid 负责语义与布局，净化后的 SVG 统一使用手写字体与 @violetjs/inkline 笔触（G 笔、草稿手法）。
 * strict 初始化与 DOMPurify 二次清理共同阻断图表源码中的可执行内容。
 *
 * 失败（语法错 / 渲染异常）返回 { error }，不抛出——阅读端据此走降级占位。
 */
import { createAsyncLoader } from "@shared/lib/create-async-loader";
import {
	createEnhancementScheduler,
	type EnhancementOptions,
	scheduleEnhancement,
} from "@shared/lib/schedule-enhancement";
import { createGPen, gpen, styles } from "@violetjs/inkline";
import { inkSvg } from "@violetjs/inkline/dom";
import DOMPurify, { type Config } from "dompurify";
import { DIAGRAM_FONT_FAMILY, loadDiagramFonts } from "./sketch-fonts";
import { getThemeVariables, type MermaidThemeVariables } from "./theme-variables";

/** 图表配色域，不依赖页面当前的主题 class。 */
export type DiagramTheme = "light" | "dark";

// G 笔配草稿手法；分支、导图连线等粗线用低压感 G 笔，两端只收到 75% 宽，不至于收成梭形
const INK_OPTIONS = {
	style: { ...styles.draft, pen: gpen, fillPen: gpen },
	thickPen: createGPen({ pressure: 0.25 }),
};

/** 完整净化手绘结果或局部失败原因；调用方不得展示未完成的中间 SVG。 */
export type RenderMermaidResult =
	| { svg: string }
	| {
			error: string;
			/** 保留原始异常以区分模块获取失败与可局部重试的渲染错误。 */
			cause: unknown;
	  };

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

const loadMermaid = createAsyncLoader(() => import("mermaid").then((module) => module.default));
const scheduleMermaid = createEnhancementScheduler();

function fitGanttTickLabels(svg: SVGSVGElement): void {
	const axes = Array.from(svg.querySelectorAll(".grid"), (axis) =>
		Array.from(axis.querySelectorAll<SVGTextElement>(".tick text"), (text) => ({
			text,
			bounds: text.getBoundingClientRect(),
		})),
	);
	for (const labels of axes) {
		const visible: typeof labels = [];
		for (const [index, label] of labels.entries()) {
			if (index === labels.length - 1) {
				while (
					visible.length &&
					visible[visible.length - 1].bounds.right + 8 > label.bounds.left
				) {
					visible.pop()?.text.setAttribute("visibility", "hidden");
				}
			}
			const previous = visible[visible.length - 1];
			if (previous && previous.bounds.right + 8 > label.bounds.left) {
				label.text.setAttribute("visibility", "hidden");
			} else {
				visible.push(label);
			}
		}
	}
}

function centerCircularLabels(svg: SVGSVGElement): void {
	const labels: { label: SVGGElement; matrix: SVGMatrix; x: number; y: number }[] = [];
	for (const circle of svg.querySelectorAll<SVGCircleElement>("circle.label-container")) {
		const label = circle.parentElement?.querySelector<SVGGElement>(":scope > .label");
		if (!label || label.querySelector("foreignObject")) continue;
		const transforms = label.transform.baseVal;
		if (!transforms.numberOfItems) continue;
		let matrix = transforms.getItem(0).matrix;
		for (let index = 1; index < transforms.numberOfItems; index++) {
			matrix = matrix.multiply(transforms.getItem(index).matrix);
		}
		const box = label.getBBox();
		const x = box.x + box.width / 2;
		const y = box.y + box.height / 2;
		labels.push({
			label,
			matrix,
			x: circle.cx.baseVal.value - matrix.a * x - matrix.c * y,
			y: circle.cy.baseVal.value - matrix.b * x - matrix.d * y,
		});
	}
	// 所有标签先测量、再修改 transform，避免每个标签都触发布局刷新。
	for (const { label, matrix, x, y } of labels) {
		matrix.e = x;
		matrix.f = y;
		label.transform.baseVal.initialize(svg.createSVGTransformFromMatrix(matrix));
	}
}

/**
 * 将 Mermaid 源码渲染为净化后的手绘 SVG；宽图保留自然字号供容器横向滚动。
 *
 * @param source - Mermaid 源码；图内指令的渲染产物仍经 DOMPurify 清理。
 * @param theme - 决定图表配色，不依赖页面当前明暗模式。
 * @param options - 图块宿主与取消信号；取消立即结束等待，不展示未完成的 SVG。
 * @returns 成功返回完整 SVG；语法错误、资源失败或取消返回错误结果，不抛出。
 * @remarks 模块与字体按需准备；Mermaid 全局配置与异步渲染独立串行。
 * 内部图型下载不占用共享计算队列，已启动的渲染须自然结束后才能启动下一图表。
 */
export async function renderMermaid(
	source: string,
	theme: DiagramTheme = "light",
	options?: EnhancementOptions,
): Promise<RenderMermaidResult> {
	try {
		const signal = options?.signal;
		signal?.throwIfAborted();
		if (!signal) return await renderMermaidSvg(source, theme, options);
		const { promise, resolve, reject } = Promise.withResolvers<{ svg: string }>();
		const abort = () => reject(signal.reason);
		signal.addEventListener("abort", abort, { once: true });
		renderMermaidSvg(source, theme, options)
			.then(resolve, reject)
			.finally(() => signal.removeEventListener("abort", abort));
		return await promise;
	} catch (error) {
		return { error: error instanceof Error ? error.message : String(error), cause: error };
	}
}

async function renderMermaidSvg(
	source: string,
	theme: DiagramTheme,
	options?: EnhancementOptions,
): Promise<{ svg: string }> {
	const mermaid = await loadMermaid();
	options?.signal?.throwIfAborted();
	await loadDiagramFonts(source);
	options?.signal?.throwIfAborted();
	return scheduleMermaid(async () => {
		// opacity 不影响图内 visibility 判定；离屏容器仍可用于字体与 SVG 测量。
		const container = document.createElement("div");
		container.style.cssText =
			"position:absolute;left:-9999px;top:0;width:920px;opacity:0;pointer-events:none;";
		container.setAttribute("aria-hidden", "true");
		try {
			const { rendering } = await scheduleEnhancement(() => {
				const themeVariables: MermaidThemeVariables = getThemeVariables(theme === "dark");
				mermaid.initialize({
					startOnLoad: false,
					securityLevel: "strict",
					look: "classic",
					htmlLabels: false,
					fontFamily: DIAGRAM_FONT_FAMILY,
					altFontFamily: DIAGRAM_FONT_FAMILY,
					themeCSS: `text, tspan, foreignObject, foreignObject * { font-family: ${DIAGRAM_FONT_FAMILY} !important; } .grid .tick text { font-size: 12px !important; }`,
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
					gantt: {
						useWidth: 908, // 920px 正文宽度扣除两侧笔触边缘。
						useMaxWidth: false,
						fontSize: 14,
						sectionFontSize: 14,
						barHeight: 28,
						barGap: 10,
						topPadding: 64,
					},
					theme: theme === "dark" ? "dark" : "base",
					themeVariables,
					// 禁止 Mermaid 将解析错误画成挂在页面底部的 errorDiagram。
					suppressErrorRendering: true,
				});
				const id = `diagram-render-${crypto.randomUUID()}`;
				document.body.appendChild(container);
				// 包装 Promise，使共享队列只等待同步启动，不等待 Mermaid 内部按需下载。
				return { rendering: mermaid.render(id, source, container) };
			}, options);
			const { svg, diagramType } = await rendering;
			return await scheduleEnhancement(() => {
				container.innerHTML = DOMPurify.sanitize(svg, SANITIZE_CONFIG) as string;
				const root = container.querySelector("svg");
				if (!root) throw new Error("图表渲染未生成 SVG");
				if (diagramType === "gantt") fitGanttTickLabels(root);
				centerCircularLabels(root);
				inkSvg(root, INK_OPTIONS);
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
			}, options);
		} finally {
			// Mermaid 只回收内层临时节点，外层测量容器由调用方回收。
			container.remove();
		}
	}, options);
}
