// @vitest-environment node
import { describe, expect, it } from "vitest";
import { normalizeTheme } from "./index.ts";

const defaults = normalizeTheme(undefined);

describe("normalizeTheme", () => {
	it("规范化合法种子色为小写六位十六进制", () => {
		expect(normalizeTheme({ version: 1, seed: "#6E56CF" }).seed).toBe("#6e56cf");
		expect(normalizeTheme({ version: 1, seed: "#F0a" }).seed).toBe("#ff00aa");
	});

	it.each([
		["非对象", "#6e56cf"],
		["数组", ["#6e56cf"]],
		["null", null],
		["缺少版本号", { seed: "#6e56cf" }],
		["未知版本", { version: 2, seed: "#6e56cf" }],
		["版本号为字符串", { version: "1", seed: "#6e56cf" }],
		["缺少种子色", { version: 1 }],
		["种子色不是十六进制", { version: 1, seed: "red" }],
		["种子色缺少 #", { version: 1, seed: "6e56cf" }],
		["种子色位数不对", { version: 1, seed: "#6e56c" }],
		["种子色夹带 CSS", { version: 1, seed: "#6e56cf;}body{color:red" }],
		["种子色为 oklch()", { version: 1, seed: "oklch(0.5 0.2 280)" }],
	])("%s时整体回落为默认主题", (_, input) => {
		expect(normalizeTheme(input)).toEqual(defaults);
	});

	it("默认主题本身是合法输入，规范化后不变", () => {
		expect(defaults).toEqual({
			version: 1,
			seed: expect.stringMatching(/^#[0-9a-f]{6}$/),
			knobs: { neutralChroma: expect.any(Number) },
		});
		expect(normalizeTheme(defaults)).toEqual(defaults);
	});

	it("非法输入回落为调用方给定的主题", () => {
		const fallback = { version: 1 as const, seed: "#336699", knobs: { neutralChroma: 0.03 } };
		expect(normalizeTheme("garbage", fallback)).toEqual(fallback);
	});

	it("省略旋钮时取默认值", () => {
		expect(normalizeTheme({ version: 1, seed: "#336699" }).knobs).toEqual(defaults.knobs);
	});

	it("保留合法旋钮，非法或越界的旋钮单独回落", () => {
		expect(
			normalizeTheme({ version: 1, seed: "#336699", knobs: { neutralChroma: 0.03 } }).knobs
				.neutralChroma,
		).toBe(0.03);
		for (const neutralChroma of [
			-0.01,
			0.2,
			Number.NaN,
			Number.POSITIVE_INFINITY,
			"0.03",
			null,
		])
			expect(
				normalizeTheme({ version: 1, seed: "#336699", knobs: { neutralChroma } }).knobs,
			).toEqual(defaults.knobs);
	});

	it("丢弃未知旋钮", () => {
		const theme = normalizeTheme({
			version: 1,
			seed: "#336699",
			knobs: { neutralChroma: 0.02, injected: "}" },
		});
		expect(theme.knobs).toEqual({ neutralChroma: 0.02 });
	});

	it("返回新对象，修改结果不影响输入与默认主题", () => {
		const input = { version: 1, seed: "#336699", knobs: { neutralChroma: 0.02 } };
		const theme = normalizeTheme(input);
		theme.knobs.neutralChroma = 0.04;
		expect(input.knobs.neutralChroma).toBe(0.02);
		normalizeTheme(undefined).knobs.neutralChroma = 0.04;
		expect(normalizeTheme(undefined)).toEqual(defaults);
	});
});
