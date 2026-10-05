/**
 * 将站点颜色转换为 Mermaid 的 hex 主题变量。
 *
 * 浅色使用站点文字与连线颜色，节点填色保留 Mermaid 默认值；
 * 暗色仅对齐背景，保留内置主题的节点与文字配对。
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

import { cssColorToHex, readSiteVar } from "@shared/lib/css-vars";

export { cssColorToHex };

const FALLBACK_LIGHT = { background: "#ffffff", foreground: "#0a0a0a", border: "#737373" };
const FALLBACK_DARK = { background: "#0a0a0a", foreground: "#fafafa", border: "#262626" };

/**
 * 为指定明暗模式读取站点颜色，不依赖页面当前主题。
 * 节点填色由 Mermaid 的 base / dark 主题决定。
 */
export function getThemeVariables(isDark: boolean): MermaidThemeVariables {
	const fallback = isDark ? FALLBACK_DARK : FALLBACK_LIGHT;
	const resolve = (varName: string, fb: string): string =>
		cssColorToHex(readSiteVar(varName, isDark)) ?? fb;
	// 暗色节点与文字必须使用内置主题的配对颜色。
	if (isDark) {
		return { background: resolve("--background", fallback.background) };
	}
	const stroke = resolve("--muted-foreground", fallback.border);
	return {
		background: resolve("--background", fallback.background),
		primaryTextColor: resolve("--foreground", fallback.foreground),
		lineColor: stroke,
		primaryBorderColor: stroke,
	};
}
