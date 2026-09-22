/**
 * OKLCH 色彩转换与对比度计算工具。
 *
 * 提供从 OKLCH 到线性 sRGB / Hex 的转换，以及 WCAG 2.1 相对亮度与对比度比值计算。
 * 纯数学实现，无外部库依赖。
 */

/**
 * 解析 oklch 颜色字符串。
 *
 * @param str - 如 "oklch(0.53 0.205 286)" 或 "oklch(0.92 0.012 286 / 12%)"
 */
export function parseOklch(str: string): { l: number; c: number; h: number; alpha: number } | null {
	const clean = str.trim();
	const match = clean.match(
		/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?(?:\s*\/\s*([\d.]+%?))?\s*\)$/i,
	);
	if (!match) return null;

	let l = Number.parseFloat(match[1]);
	if (match[2] === "%") {
		l /= 100;
	}
	const c = Number.parseFloat(match[3]);
	const h = Number.parseFloat(match[4]);
	let alpha = 1;

	if (match[5]) {
		const aStr = match[5];
		if (aStr.endsWith("%")) {
			alpha = Number.parseFloat(aStr.slice(0, -1)) / 100;
		} else {
			alpha = Number.parseFloat(aStr);
		}
	}

	return { l, c, h, alpha: Math.min(Math.max(alpha, 0), 1) };
}

/**
 * 将 OKLCH (L, C, H) 转换至 sRGB 空间及 16 进制 Hex 字符串。
 *
 * @param L - 明度 0..1
 * @param C - 彩度 0..0.4+
 * @param H - 色相角度 0..360
 * @param alpha - 不透明度 0..1，小于 1 时输出 8 位 Hex
 */
export function oklchToRgb(
	L: number,
	C: number,
	H: number,
	alpha = 1,
): {
	r: number;
	g: number;
	b: number;
	hex: string;
	alpha: number;
	rLin: number;
	gLin: number;
	bLin: number;
} {
	const hRad = (H * Math.PI) / 180;
	const a = C * Math.cos(hRad);
	const b = C * Math.sin(hRad);

	const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
	const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
	const s_ = L - 0.0894841775 * a - 1.291485548 * b;

	const l = l_ ** 3;
	const m = m_ ** 3;
	const s = s_ ** 3;

	const r = +4.0767434036 * l - 3.3077115913 * m + 0.2309699292 * s;
	const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
	const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

	const clamp = (x: number) => Math.min(Math.max(x, 0), 1);
	const rLin = clamp(r);
	const gLin = clamp(g);
	const bLin = clamp(bl);

	const gamma = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);

	const R = Math.round(clamp(gamma(rLin)) * 255);
	const G = Math.round(clamp(gamma(gLin)) * 255);
	const B = Math.round(clamp(gamma(bLin)) * 255);

	const safeAlpha = clamp(alpha);
	const aHex =
		safeAlpha < 1
			? Math.round(safeAlpha * 255)
					.toString(16)
					.padStart(2, "0")
			: "";

	const hex = `#${[R, G, B].map((x) => x.toString(16).padStart(2, "0")).join("")}${aHex}`;

	return { r: R, g: G, b: B, hex, alpha: safeAlpha, rLin, gLin, bLin };
}

/**
 * 计算线性 sRGB 的 WCAG 相对亮度。
 */
export function getRelativeLuminance(rLin: number, gLin: number, bLin: number): number {
	return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * 计算任意 OKLCH 颜色与另一 OKLCH 颜色之间的 WCAG 2.1 对比度 (1..21)。
 * 若前景色包含 alpha (<1)，将先在线性 sRGB 空间与背景混色后再求相对亮度。
 *
 * @param fgOklch - 前景色 oklch 字符串
 * @param bgOklch - 背景色 oklch 字符串
 * @returns 对比度比值，如 5.75 表示 5.75:1
 */
export function getContrastRatio(fgOklch: string, bgOklch: string): number {
	const fg = parseOklch(fgOklch);
	const bg = parseOklch(bgOklch);
	if (!fg || !bg) return 1;

	const fgRgb = oklchToRgb(fg.l, fg.c, fg.h, fg.alpha);
	const bgRgb = oklchToRgb(bg.l, bg.c, bg.h, bg.alpha);

	// 线性空间混色合成
	const rLinComposited = fgRgb.rLin * fg.alpha + bgRgb.rLin * (1 - fg.alpha);
	const gLinComposited = fgRgb.gLin * fg.alpha + bgRgb.gLin * (1 - fg.alpha);
	const bLinComposited = fgRgb.bLin * fg.alpha + bgRgb.bLin * (1 - fg.alpha);

	const l1 = getRelativeLuminance(rLinComposited, gLinComposited, bLinComposited);
	const l2 = getRelativeLuminance(bgRgb.rLin, bgRgb.gLin, bgRgb.bLin);

	const brighter = Math.max(l1, l2);
	const darker = Math.min(l1, l2);

	return Number(((brighter + 0.05) / (darker + 0.05)).toFixed(2));
}

/**
 * 评估 WCAG 评级。
 *
 * @param ratio - 对比度比值
 */
export function getWcagRating(ratio: number): {
	rating: "AAA" | "AA" | "AA Large" | "Fail";
	isAccessible: boolean;
} {
	if (ratio >= 7.0) {
		return { rating: "AAA", isAccessible: true };
	}
	if (ratio >= 4.5) {
		return { rating: "AA", isAccessible: true };
	}
	if (ratio >= 3.0) {
		return { rating: "AA Large", isAccessible: true };
	}
	return { rating: "Fail", isAccessible: false };
}

/**
 * hexToOklch - #rrggbb → OKLCH，oklchToRgb 的逆向。
 *
 * 供「给一个主色、推导整板」的交互使用：用户给的是 hex，
 * 推导管线需要色相与彩度。8-bit 量化导致往返误差，L ±0.005、
 * C ±0.005、H ±1°以内。
 *
 * @param hex - #rrggbb 或 #rrggbbaa（alpha 忽略）
 * @returns l 0..1、c 0..0.4+、h 0..360；非法输入返回 null
 */
export function hexToOklch(hex: string): { l: number; c: number; h: number } | null {
	const match = hex.trim().match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
	if (!match) return null;
	const n = Number.parseInt(match[1], 16);
	const r = ((n >> 16) & 0xff) / 255;
	const g = ((n >> 8) & 0xff) / 255;
	const b = (n & 0xff) / 255;

	const linearize = (x: number) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
	const rLin = linearize(r);
	const gLin = linearize(g);
	const bLin = linearize(b);

	// sRGB → OKLab（Björn Ottosson 标准矩阵）
	const l_ = Math.cbrt(0.4122214708 * rLin + 0.5363325363 * gLin + 0.0514459929 * bLin);
	const m_ = Math.cbrt(0.2119034982 * rLin + 0.6806995451 * gLin + 0.1073969566 * bLin);
	const s_ = Math.cbrt(0.0883024619 * rLin + 0.2817188376 * gLin + 0.6299787005 * bLin);

	const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
	const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
	const b2 = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

	const c = Math.sqrt(a * a + b2 * b2);
	let h = (Math.atan2(b2, a) * 180) / Math.PI;
	if (h < 0) h += 360;

	return { l: Number(L.toFixed(4)), c: Number(c.toFixed(4)), h: Number(h.toFixed(2)) };
}
