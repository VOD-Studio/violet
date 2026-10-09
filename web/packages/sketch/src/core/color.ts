/** 在 OKLCH 中推导风格所需的派生色；Oklab 见 Ottosson 2020。 */

interface Lch {
	l: number;
	c: number;
	h: number;
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

/**
 * 解析 #rgb、#rrggbb 色值为 OKLCH。
 *
 * @throws 当输入不是十六进制色值；派生色只支持这一种写法。
 */
export function parseColor(css: string): Lch {
	let hex = css.trim().replace(/^#/, "");
	if (hex.length === 3) hex = [...hex].map((ch) => ch + ch).join("");
	if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) throw new Error(`无法解析颜色：${css}`);
	const r = toLinear(Number.parseInt(hex.slice(0, 2), 16) / 255);
	const g = toLinear(Number.parseInt(hex.slice(2, 4), 16) / 255);
	const b = toLinear(Number.parseInt(hex.slice(4, 6), 16) / 255);
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
	const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
	const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
	return { l: L, c: Math.hypot(a, bb), h: (Math.atan2(bb, a) * 180) / Math.PI };
}

function toRgb({ l, c, h }: Lch): [number, number, number] | null {
	const a = c * Math.cos((h * Math.PI) / 180);
	const b = c * Math.sin((h * Math.PI) / 180);
	const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
	const rgb: [number, number, number] = [
		4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
		-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
		-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
	];
	return rgb.every((v) => v >= -0.0005 && v <= 1.0005) ? rgb : null;
}

/** 输出 #rrggbb；超出 sRGB 色域时降低彩度直至落入，保持明度与色相。 */
export function formatColor(color: Lch): string {
	let lo = 0;
	let hi = color.c;
	let rgb = toRgb(color);
	if (!rgb) {
		for (let i = 0; i < 12; i++) {
			const mid = (lo + hi) / 2;
			if (toRgb({ ...color, c: mid })) lo = mid;
			else hi = mid;
		}
		rgb = toRgb({ ...color, c: lo }) ?? [0, 0, 0];
	}
	return `#${rgb
		.map((v) =>
			Math.round(Math.max(0, Math.min(1, toGamma(Math.max(0, v)))) * 255)
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;
}

/** 把色相朝 target 方向转 amount（比例），最多 maxDegrees 度。 */
function shiftHue(h: number, target: number, amount: number, maxDegrees: number): number {
	const delta = ((((target - h) % 360) + 540) % 360) - 180;
	return h + Math.max(-maxDegrees, Math.min(maxDegrees, delta * amount));
}

/**
 * 阴影色：压暗，色相偏向冷色（Gooch 1998 的冷暖明暗），彩度略升。
 *
 * @returns #rrggbb
 */
export function shadeOf(css: string): string {
	const { l, c, h } = parseColor(css);
	return formatColor({
		l: l * 0.8 - 0.015,
		c: c * 1.08 + 0.01,
		h: shiftHue(h, 285, 0.2, 28),
	});
}

/** 高光色：提亮、降彩度，色相偏向暖色。 */
export function lightOf(css: string): string {
	const { l, c, h } = parseColor(css);
	return formatColor({
		l: Math.min(0.985, l + (1 - l) * 0.5 + 0.02),
		c: c * 0.75,
		h: shiftHue(h, 90, 0.12, 14),
	});
}

/** 线色：同色相的深色，用于色线勾边。 */
export function lineOf(css: string): string {
	const { l, c, h } = parseColor(css);
	return formatColor({ l: l * 0.4, c: Math.min(c * 0.8, 0.09), h });
}

/** 派生色角色的后缀。 */
export const SHADE = ":shade";
export const LIGHT = ":light";
export const LINE = ":line";

/**
 * 为每个基础色派生 `角色:shade`、`角色:light` 与 `角色:line`；paper 与 ink 及已带冒号的角色保持原样。
 *
 * @example
 * ```ts
 * const palette = cartoonPalette({ paper: "#fffdf7", ink: "#2b2836", sky: "#b9dbea" });
 * // palette["sky:shade"]、palette["sky:light"]、palette["sky:line"]
 * ```
 */
export function cartoonPalette(base: Readonly<Record<string, string>>): Record<string, string> {
	const out: Record<string, string> = { ...base };
	for (const [role, color] of Object.entries(base)) {
		if (role === "paper" || role === "ink" || role.includes(":")) continue;
		out[role + SHADE] = shadeOf(color);
		out[role + LIGHT] = lightOf(color);
		out[role + LINE] = lineOf(color);
	}
	return out;
}
