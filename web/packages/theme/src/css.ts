import { type Appearance, type Scale, STEPS, type ThemeScales } from "./generate.ts";

/** 序列化选项：选择器与变量前缀。 */
export interface CssOptions {
	/**
	 * 承载自定义属性的选择器。
	 *
	 * @default ":root"
	 */
	selector?: string;
	/**
	 * 变量名前缀，只允许 ASCII 字母、数字、`-` 与 `_`；例如 `"v-"` 得到 `--v-brand-1`。
	 *
	 * @default ""
	 */
	prefix?: string;
}

const PREFIX = /^[\w-]*$/;
// 选择器由调用方提供；拒绝能结束规则、声明或 <style> 元素的字符，防止拼出额外的样式或标签
const UNSAFE_SELECTOR = /[{};<]/;

const entries = (name: string, scale: Scale): [string, string][] => [
	...STEPS.map((step): [string, string] => [`${name}-${step}`, scale.steps[step]]),
	[`${name}-contrast`, scale.contrast],
];

const variables = (scales: ThemeScales) => [
	...entries("brand", scales.brand),
	...entries("neutral", scales.neutral),
];

/**
 * 把生成结果序列化为一条 CSS 规则，每档一个自定义属性：`--brand-1` … `--brand-12`、`--brand-contrast`，
 * 中性色阶同理。
 *
 * 同时传入浅色与深色结果时，每个值写成 `light-dark(浅色, 深色)`，由页面的 `color-scheme` 决定取哪一支；
 * 只传一种外观时直接写值。
 *
 * @param scales - {@link generateScales} 的结果，单个或每种外观各一个
 * @throws TypeError 结果为空、外观重复，或选择器、前缀含不安全字符
 * @example
 * ```ts
 * const theme = normalizeTheme({ version: 1, seed: "#3a7bd5" });
 * const css = toCssVariables([
 *   generateScales(theme, { appearance: "light" }),
 *   generateScales(theme, { appearance: "dark" }),
 * ]);
 * // :root {
 * //   --brand-1: light-dark(oklch(…), oklch(…));
 * //   …
 * // }
 * ```
 */
export function toCssVariables(
	scales: ThemeScales | readonly ThemeScales[],
	options: CssOptions = {},
): string {
	const { selector = ":root", prefix = "" } = options;
	if (!selector.trim() || UNSAFE_SELECTOR.test(selector))
		throw new TypeError(`Unsafe selector: ${selector}`);
	if (!PREFIX.test(prefix)) throw new TypeError(`Invalid custom property prefix: ${prefix}`);
	const list = Array.isArray(scales) ? scales : [scales as ThemeScales];
	const byAppearance = new Map<Appearance, ThemeScales>();
	for (const item of list) {
		if (byAppearance.has(item.appearance))
			throw new TypeError(`Duplicate appearance: ${item.appearance}`);
		byAppearance.set(item.appearance, item);
	}
	const light = byAppearance.get("light");
	const dark = byAppearance.get("dark");
	const only = light ?? dark;
	if (!only) throw new TypeError("Expected at least one generated appearance");
	const darkValues = dark ? new Map(variables(dark)) : undefined;
	const declarations = variables(only).map(([name, value]) => {
		const paired =
			light && darkValues ? `light-dark(${value}, ${darkValues.get(name)})` : value;
		return `\t--${prefix}${name}: ${paired};`;
	});
	return `${selector} {\n${declarations.join("\n")}\n}\n`;
}
