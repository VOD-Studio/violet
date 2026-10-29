// @vitest-environment node
import { describe, expect, it } from "vitest";
import { generateScales, toCssVariables } from "./index.ts";

const theme = { version: 1, seed: "#3a7bd5" } as const;
const light = generateScales(theme, { appearance: "light" });
const dark = generateScales(theme, { appearance: "dark" });
const lightMore = generateScales(theme, { appearance: "light", contrast: "more" });
const darkMore = generateScales(theme, { appearance: "dark", contrast: "more" });
const MORE = "@media (prefers-contrast: more)";

const parseDeclarations = (block: string) =>
	Object.fromEntries(
		block
			.split(";")
			.map((declaration) => declaration.trim())
			.filter(Boolean)
			.map((declaration) => {
				const index = declaration.indexOf(":");
				return [declaration.slice(0, index).trim(), declaration.slice(index + 1).trim()];
			}),
	);

/** 拆出唯一一条规则的选择器与声明。 */
const parseRule = (css: string) => {
	const match = /^([^{]+)\{([^}]*)\}\s*$/.exec(css);
	if (!match) throw new Error(`Not a single rule:\n${css}`);
	return { selector: match[1]?.trim(), declarations: parseDeclarations(match[2] ?? "") };
};

/** 拆出普通规则与 `prefers-contrast: more` 中的规则。 */
const parseSheet = (css: string) => {
	const index = css.indexOf(MORE);
	const base = index < 0 ? css : css.slice(0, index);
	const more = index < 0 ? "" : css.slice(index + MORE.length).trim();
	const inner = /^\{\s*([\s\S]*)\}\s*$/.exec(more)?.[1];
	return {
		base: base.trim() ? parseRule(base) : undefined,
		more: inner ? parseRule(inner) : undefined,
	};
};

const steps = (name: string) => Array.from({ length: 12 }, (_, index) => `--${name}-${index + 1}`);
const alpha = (name: string) => Array.from({ length: 12 }, (_, index) => `--${name}-a${index + 1}`);
const NAMES = [
	...["brand", "neutral"].flatMap((name) => [
		...steps(name),
		`--${name}-contrast`,
		...alpha(name),
	]),
	...["danger", "warning", "success"].flatMap((name) => [...steps(name), `--${name}-contrast`]),
	...light.categorical.flatMap((_, index) => [
		...steps(`category-${index + 1}`),
		`--category-${index + 1}-contrast`,
	]),
];

describe("toCssVariables", () => {
	it("单一外观输出 :root 规则，涵盖品牌、中性、透明度、状态与分类色阶", () => {
		const { selector, declarations } = parseRule(toCssVariables(light));
		expect(selector).toBe(":root");
		expect(Object.keys(declarations)).toEqual(NAMES);
		expect(declarations["--brand-9"]).toBe(light.brand.steps[9]);
		expect(declarations["--brand-contrast"]).toBe(light.brand.contrast);
		expect(declarations["--brand-a3"]).toBe(light.brand.alpha[3]);
		expect(declarations["--neutral-12"]).toBe(light.neutral.steps[12]);
		expect(declarations["--danger-9"]).toBe(light.status.danger.steps[9]);
		expect(declarations["--category-2-11"]).toBe(light.categorical[1]?.steps[11]);
	});

	it("同时给出浅色与深色时以 light-dark() 合并，与传入顺序无关", () => {
		const css = toCssVariables([dark, light]);
		expect(css).toBe(toCssVariables([light, dark]));
		const { declarations } = parseRule(css);
		expect(Object.keys(declarations)).toEqual(NAMES);
		expect(declarations["--brand-1"]).toBe(
			`light-dark(${light.brand.steps[1]}, ${dark.brand.steps[1]})`,
		);
		expect(declarations["--neutral-contrast"]).toBe(
			`light-dark(${light.neutral.contrast}, ${dark.neutral.contrast})`,
		);
		expect(declarations["--success-a1"]).toBeUndefined();
	});

	it("提高对比度档位写进 prefers-contrast: more 媒体查询，覆盖同名变量", () => {
		const { base, more } = parseSheet(toCssVariables([darkMore, light, lightMore, dark]));
		expect(base?.declarations).toEqual(parseRule(toCssVariables([light, dark])).declarations);
		expect(more?.selector).toBe(":root");
		expect(Object.keys(more?.declarations ?? {})).toEqual(NAMES);
		expect(more?.declarations["--brand-12"]).toBe(
			`light-dark(${lightMore.brand.steps[12]}, ${darkMore.brand.steps[12]})`,
		);
		const only = parseSheet(toCssVariables(lightMore));
		expect(only.base).toBeUndefined();
		expect(only.more?.declarations["--brand-9"]).toBe(lightMore.brand.steps[9]);
	});

	it("支持自定义选择器与变量前缀", () => {
		const { selector, declarations } = parseRule(
			toCssVariables(light, { selector: '[data-theme="ocean"]', prefix: "v-" }),
		);
		expect(selector).toBe('[data-theme="ocean"]');
		expect(Object.keys(declarations)).toEqual(NAMES.map((name) => name.replace("--", "--v-")));
	});

	it("拒绝同一外观与档位重复、空输入与可能破坏样式表的选择器或前缀", () => {
		expect(() => toCssVariables([light, light])).toThrow(TypeError);
		expect(() => toCssVariables([light, lightMore])).not.toThrow();
		expect(() => toCssVariables([])).toThrow(TypeError);
		for (const selector of [":root{}body", ":root;", "</style><script>", ""])
			expect(() => toCssVariables(light, { selector }), selector).toThrow(TypeError);
		for (const prefix of ["v-;", " v", "v.", "v:"])
			expect(() => toCssVariables(light, { prefix }), prefix).toThrow(TypeError);
	});
});
