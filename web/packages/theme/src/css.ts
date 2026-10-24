import {
	type Appearance,
	type ContrastLevel,
	type Scale,
	STEPS,
	type ThemeScales,
} from "./generate.ts";

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
const LEVELS: readonly ContrastLevel[] = ["standard", "more"];

const entries = (name: string, scale: Scale & { alpha?: Scale["steps"] }): [string, string][] => [
	...STEPS.map((step): [string, string] => [`${name}-${step}`, scale.steps[step]]),
	[`${name}-contrast`, scale.contrast],
	...(scale.alpha
		? STEPS.map((step): [string, string] => [`${name}-a${step}`, scale.alpha?.[step] ?? ""])
		: []),
];

const variables = (scales: ThemeScales): [string, string][] => [
	...entries("brand", scales.brand),
	...entries("neutral", scales.neutral),
	...entries("danger", scales.status.danger),
	...entries("warning", scales.status.warning),
	...entries("success", scales.status.success),
];

/** 同一档位的声明；浅色与深色都在时合并为 light-dark()。 */
function declarations(byAppearance: Map<Appearance, ThemeScales>, prefix: string, indent: string) {
	const light = byAppearance.get("light");
	const dark = byAppearance.get("dark");
	const only = light ?? dark;
	if (!only) return undefined;
	const darkValues = dark ? new Map(variables(dark)) : undefined;
	return variables(only)
		.map(([name, value]) => {
			const paired =
				light && darkValues ? `light-dark(${value}, ${darkValues.get(name)})` : value;
			return `${indent}--${prefix}${name}: ${paired};`;
		})
		.join("\n");
}

/**
 * 把生成结果序列化为样式表：每档一个自定义属性。品牌与中性为 `--brand-1` … `--brand-12`、
 * `--brand-contrast` 与透明度色阶 `--brand-a1` … `--brand-a12`；状态色为 `--danger-*`、`--warning-*`、
 * `--success-*`。
 *
 * 同一档位同时传入浅色与深色时，每个值写成 `light-dark(浅色, 深色)`，由页面的 `color-scheme` 决定取哪一支；
 * 只传一种外观时直接写值。提高对比度档位写进 `@media (prefers-contrast: more)`，覆盖同名变量。
 *
 * @param scales - {@link generateScales} 的结果，单个或多个；每种外观与档位的组合至多一个
 * @throws TypeError 结果为空、外观与档位重复，或选择器、前缀含不安全字符
 * @example
 * ```ts
 * const theme = normalizeTheme({ version: 1, seed: "#3a7bd5" });
 * const css = toCssVariables(
 *   (["light", "dark"] as const).flatMap((appearance) =>
 *     (["standard", "more"] as const).map((contrast) => generateScales(theme, { appearance, contrast })),
 *   ),
 * );
 * // :root {
 * // 	--brand-1: light-dark(oklch(…), oklch(…));
 * // 	…
 * // }
 * // @media (prefers-contrast: more) {
 * // 	:root { … }
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
	if (list.length === 0) throw new TypeError("Expected at least one generated appearance");
	const grouped = new Map<ContrastLevel, Map<Appearance, ThemeScales>>();
	for (const item of list) {
		const level = grouped.get(item.contrast) ?? new Map<Appearance, ThemeScales>();
		if (level.has(item.appearance))
			throw new TypeError(
				`Duplicate appearance and contrast: ${item.appearance} ${item.contrast}`,
			);
		level.set(item.appearance, item);
		grouped.set(item.contrast, level);
	}
	const blocks = LEVELS.flatMap((level) => {
		const group = grouped.get(level);
		if (!group) return [];
		if (level === "standard")
			return [`${selector} {\n${declarations(group, prefix, "\t")}\n}\n`];
		return [
			`@media (prefers-contrast: more) {\n\t${selector} {\n${declarations(group, prefix, "\t\t")}\n\t}\n}\n`,
		];
	});
	return blocks.join("\n");
}
