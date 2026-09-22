/**
 * theme-variables - mermaid 主题变量映射（站点 oklch → mermaid hex）
 *
 * 单一职责：读站点 CSS 变量（shadcn neutral oklch 调色板）→ 转 hex →
 * 组装 mermaid themeVariables。明暗双策略（render-mermaid.ts 按此切换 theme）：
 * - light：base 主题 + 框架色对齐站点；节点填色刻意不设置，保留 mermaid
 *   默认彩色（PRD「节点保色」决策）
 * - dark：内置 dark 主题，仅背景对齐站点——节点深色系填充与浅色文字由
 *   主题全图配对（base + 手动文字色矩阵在 journey/sectionColours 等处
 *   不可维护，社区标准做法即明暗各用各的主题）
 *
 * 探针元素带 .dark 类即可读到暗色变量（.dark 选择器匹配任意带该类的元素，
 * 不依赖 <html> 当前实际主题）——切主题时调用方重新调用本函数即可，无副作用。
 */
/** mermaid themeVariables 子集：只覆盖框架色，节点填色留给 mermaid 主题自带 */
export interface MermaidThemeVariables {
	/** 图表整体背景 */
	background?: string;
	/** 节点内文字色（on 节点填充） */
	primaryTextColor?: string;
	/** 连线颜色 */
	lineColor?: string;
	/** 主边框颜色 */
	primaryBorderColor?: string;
}

/** 站点 CSS 变量读不到时（SSR / 测试环境无 CSS）的灰度兜底，保证渲染不白屏 */
import { cssColorToHex, readSiteVar } from "@shared/lib/css-vars";

export { cssColorToHex };

const FALLBACK_LIGHT = { background: "#ffffff", foreground: "#0a0a0a", border: "#e5e5e5" };
const FALLBACK_DARK = { background: "#0a0a0a", foreground: "#fafafa", border: "#262626" };

/**
 * getThemeVariables - 组装 mermaid themeVariables（站点明暗 → mermaid hex）
 *
 * 框架色从站点 CSS 变量读取并转 hex；节点填色（primaryColor 等）不设置，
 * 保留 mermaid 默认彩色（PRD「框架对齐明暗 + 节点保色」策略）。
 * isDark 决定读浅色（:root）还是深色（.dark）变体。
 */
export function getThemeVariables(isDark: boolean): MermaidThemeVariables {
	const fallback = isDark ? FALLBACK_DARK : FALLBACK_LIGHT;
	const resolve = (varName: string, fb: string): string =>
		cssColorToHex(readSiteVar(varName, isDark)) ?? fb;
	// dark 走内置 dark 主题（render-mermaid.ts 按明暗切换 theme）：节点深色系
	// 填充与浅色文字已全图配对，只需把背景对齐站点；连线/边框/文字用主题
	// 内建值（站点 border 灰在深色节点上对比度不足）。
	// light 走 base 主题：框架色对齐站点，节点填色保留默认彩色（PRD 决策）。
	if (isDark) {
		return { background: resolve("--background", fallback.background) };
	}
	return {
		background: resolve("--background", fallback.background),
		primaryTextColor: resolve("--foreground", fallback.foreground),
		lineColor: resolve("--border", fallback.border),
		primaryBorderColor: resolve("--border", fallback.border),
	};
}
