/** PROTOTYPE（#645）：把方向的种子色与旋钮生成成可注入的 CSS。 */
import {
	type ContrastLevel,
	generateScales,
	type ThemeScales,
	toCssVariables,
} from "@violetjs/theme";

const cssCache = new Map<string, string>();
const scaleCache = new Map<string, ThemeScales>();

export function scalesOf(
	seed: string,
	neutralChroma: number,
	appearance: "light" | "dark",
	contrast: ContrastLevel = "standard",
) {
	const key = `${seed}|${neutralChroma}|${appearance}|${contrast}`;
	let scales = scaleCache.get(key);
	if (!scales) {
		scales = generateScales(
			{ version: 1, seed, knobs: { neutralChroma } },
			{ appearance, contrast },
		);
		scaleCache.set(key, scales);
	}
	return scales;
}

/** 生成明暗与两档对比度的全部色阶变量，作用于 selector。 */
export function themeCss(seed: string, neutralChroma: number, selector: string): string {
	const key = `${seed}|${neutralChroma}|${selector}`;
	let css = cssCache.get(key);
	if (!css) {
		const combos = (["light", "dark"] as const).flatMap((appearance) =>
			(["standard", "more"] as const).map((contrast) =>
				scalesOf(seed, neutralChroma, appearance, contrast),
			),
		);
		css = toCssVariables(combos, { selector });
		cssCache.set(key, css);
	}
	return css;
}

/** 只生成某一档对比度的明暗变量，供对照板模拟「提高对比度」。 */
export function themeCssAt(
	seed: string,
	neutralChroma: number,
	selector: string,
	contrast: ContrastLevel,
): string {
	if (contrast === "standard") return themeCss(seed, neutralChroma, selector);
	const key = `${seed}|${neutralChroma}|${selector}|${contrast}`;
	let css = cssCache.get(key);
	if (!css) {
		css = toCssVariables(
			(["light", "dark"] as const).map((appearance) =>
				scalesOf(seed, neutralChroma, appearance, contrast),
			),
			{ selector },
		);
		cssCache.set(key, css);
	}
	return css;
}

// —— WCAG 对比度（只为样稿标注，不进正式代码）——

function parseOklch(value: string): [number, number, number] {
	const match = /oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/.exec(value);
	return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : [0, 0, 0];
}

function luminance(value: string): number {
	const [l, c, h] = parseOklch(value);
	const a = c * Math.cos((h * Math.PI) / 180);
	const b = c * Math.sin((h * Math.PI) / 180);
	const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
	const r = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
	const g = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
	const bl = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_;
	const clamp = (x: number) => Math.min(1, Math.max(0, x));
	return 0.2126 * clamp(r) + 0.7152 * clamp(g) + 0.0722 * clamp(bl);
}

export function wcag(a: string, b: string): number {
	const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
	return (x + 0.05) / (y + 0.05);
}

/** 实色上的前景是白字还是深字。 */
export function foregroundKind(scales: ThemeScales): "白字" | "深字" {
	return parseOklch(scales.brand.contrast)[0] > 0.6 ? "白字" : "深字";
}
