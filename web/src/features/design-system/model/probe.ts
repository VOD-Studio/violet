import { oklchToRgb, parseOklch } from "@shared/lib/color-math";
import { cssColorToHex, readSiteVar } from "@shared/lib/css-vars";

/** 明暗双域 */
export type TokenDomain = "light" | "dark";

export interface TokenValue {
	/** CSS 变量原始值（oklch(...) 等），读不到为 null */
	raw: string | null;
	/** #rrggbb 形式，转换失败为 null */
	hex: string | null;
}

/**
 * tokenColorToHex - 原始色值 → #rrggbb
 *
 * oklch 走纯数学换算：现代 Chrome 的 computed color 对宽色域颜色保留
 * oklch 形式，cssColorToHex 借 computed 样式的 rgb() 正则会扑空；
 * 其余格式（hex/rgb/hsl/named）仍借浏览器解析器。
 */
export function tokenColorToHex(raw: string): string | null {
	if (!raw.trim()) return null;
	const parsed = parseOklch(raw);
	if (parsed) {
		return oklchToRgb(parsed.l, parsed.c, parsed.h, parsed.alpha).hex;
	}
	return cssColorToHex(raw);
}

/**
 * readTokenValue - 读单个颜色 token 在指定明暗域的实时值
 *
 * 浅色读 :root 作用域，深色读 .dark 作用域（探针元素带 .dark 类，
 * 与页面当前主题解耦）。空值语义：变量不存在时 raw 为 null，调用方
 * 渲染「—」占位而非黑色。
 */
export function readTokenValue(varName: string, domain: TokenDomain): TokenValue {
	const raw = readSiteVar(varName, domain === "dark");
	return { raw: raw || null, hex: raw ? tokenColorToHex(raw) : null };
}
