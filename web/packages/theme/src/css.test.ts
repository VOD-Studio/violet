// @vitest-environment node
import { describe, expect, it } from "vitest";
import { generateScales, toCssVariables } from "./index.ts";

const theme = { version: 1, seed: "#3a7bd5" } as const;
const light = generateScales(theme, { appearance: "light" });
const dark = generateScales(theme, { appearance: "dark" });

/** 拆出唯一一条规则的选择器与声明。 */
const parseRule = (css: string) => {
	const match = /^([^{]+)\{([^}]*)\}\s*$/.exec(css);
	if (!match) throw new Error(`Not a single rule:\n${css}`);
	const declarations = Object.fromEntries(
		(match[2] ?? "")
			.split(";")
			.map((declaration) => declaration.trim())
			.filter(Boolean)
			.map((declaration) => {
				const index = declaration.indexOf(":");
				return [declaration.slice(0, index).trim(), declaration.slice(index + 1).trim()];
			}),
	);
	return { selector: match[1]?.trim(), declarations };
};

const NAMES = ["brand", "neutral"].flatMap((scale) => [
	...Array.from({ length: 12 }, (_, index) => `--${scale}-${index + 1}`),
	`--${scale}-contrast`,
]);

describe("toCssVariables", () => {
	it("单一外观输出 :root 规则，每档一个自定义属性", () => {
		const { selector, declarations } = parseRule(toCssVariables(light));
		expect(selector).toBe(":root");
		expect(Object.keys(declarations)).toEqual(NAMES);
		expect(declarations["--brand-9"]).toBe(light.brand.steps[9]);
		expect(declarations["--brand-contrast"]).toBe(light.brand.contrast);
		expect(declarations["--neutral-12"]).toBe(light.neutral.steps[12]);
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
	});

	it("支持自定义选择器与变量前缀", () => {
		const { selector, declarations } = parseRule(
			toCssVariables(light, { selector: '[data-theme="ocean"]', prefix: "v-" }),
		);
		expect(selector).toBe('[data-theme="ocean"]');
		expect(Object.keys(declarations)).toEqual(NAMES.map((name) => name.replace("--", "--v-")));
	});

	it("拒绝重复外观、空输入与可能破坏样式表的选择器或前缀", () => {
		expect(() => toCssVariables([light, light])).toThrow(TypeError);
		expect(() => toCssVariables([])).toThrow(TypeError);
		for (const selector of [":root{}body", ":root;", "</style><script>", ""])
			expect(() => toCssVariables(light, { selector }), selector).toThrow(TypeError);
		for (const prefix of ["v-;", " v", "v.", "v:"])
			expect(() => toCssVariables(light, { prefix }), prefix).toThrow(TypeError);
	});
});
