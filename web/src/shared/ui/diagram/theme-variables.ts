import { cssColorToHex, readSiteColors } from "@shared/lib/css-vars";

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

const FALLBACK_LIGHT = { background: "#ffffff", foreground: "#0a0a0a", border: "#737373" };
const FALLBACK_DARK = { background: "#0a0a0a", foreground: "#fafafa", border: "#262626" };

/**
 * 为指定明暗模式批量读取站点颜色，保留 Mermaid 的节点填色。
 *
 * @param isDark - 显式的图表主题，不依赖页面当前主题。
 * @returns Mermaid 使用的十六进制主题变量；SSR 或颜色不可解析时使用对应明暗域的默认值。
 * @remarks 不缓存主题值；探针由共享颜色工具复用，暗色节点与文字仍使用 Mermaid 内置配对。
 */
export function getThemeVariables(isDark: boolean): MermaidThemeVariables {
	const fallback = isDark ? FALLBACK_DARK : FALLBACK_LIGHT;
	const colors = readSiteColors(
		isDark ? ["--background"] : ["--background", "--foreground", "--muted-foreground"],
		isDark,
	);
	const resolve = (varName: string, fb: string): string => colors[varName] ?? fb;
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

export { cssColorToHex };
