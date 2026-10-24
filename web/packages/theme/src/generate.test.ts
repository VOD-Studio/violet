// @vitest-environment node
import { describe, expect, it } from "vitest";
import { type Appearance, generateScales, type Scale } from "./index.ts";
import { coords, parse, toHex } from "./test/colors.ts";
import { APPEARANCES, STEPS } from "./test/sweep.ts";

describe("generateScales", () => {
	it("为品牌与中性各生成 12 档与实色前景，全部是 oklch()", () => {
		const scales = generateScales({ version: 1, seed: "#684dda" }, { appearance: "light" });
		expect(scales).toMatchObject({ appearance: "light", gamut: "srgb" });
		for (const scale of [scales.brand, scales.neutral]) {
			expect(Object.keys(scale.steps).map(Number)).toEqual([...STEPS]);
			for (const css of [...Object.values(scale.steps), scale.contrast])
				expect(() => parse(css)).not.toThrow();
		}
	});

	it("种子色非法时抛出 TypeError", () => {
		expect(() => generateScales({ version: 1, seed: "red" }, { appearance: "light" })).toThrow(
			TypeError,
		);
	});

	it("种子色本身满足门槛时，两种外观的实色档都就是种子色", () => {
		const solid = (seed: string, appearance: Appearance) =>
			toHex(parse(generateScales({ version: 1, seed }, { appearance }).brand.steps[9]));
		// 中等亮度的饱和色配白字，浅色调配深字，两种外观都原样保留
		for (const seed of [
			"#684dda",
			"#2563eb",
			"#dc2626",
			"#15803d",
			"#0f766e",
			"#7c3aed",
			"#db2777",
			"#93c5fd",
		])
			for (const appearance of APPEARANCES)
				expect(solid(seed, appearance), `${seed} ${appearance}`).toBe(seed);
	});

	it("白字可读的种子配白字，亮种子保持明亮并配深字，两种外观一致", () => {
		const foreground = (seed: string, appearance: Appearance) =>
			coords(generateScales({ version: 1, seed }, { appearance }).brand.contrast).l;
		for (const appearance of APPEARANCES) {
			expect(foreground("#684dda", appearance)).toBeGreaterThan(0.95);
			expect(foreground("#facc15", appearance)).toBeLessThan(0.25);
			expect(
				coords(
					generateScales({ version: 1, seed: "#facc15" }, { appearance }).brand.steps[9],
				).l,
			).toBeGreaterThan(0.8);
		}
	});

	it("相同输入得出逐字相同的输出", () => {
		const theme = { version: 1, seed: "#3a7bd5", knobs: { neutralChroma: 0.02 } } as const;
		for (const appearance of APPEARANCES)
			expect(JSON.stringify(generateScales(theme, { appearance }))).toBe(
				JSON.stringify(generateScales(structuredClone(theme), { appearance })),
			);
	});

	it("中性色阶的色度由旋钮控制，旋钮为 0 时是纯灰", () => {
		const peak = (scale: Scale) =>
			Math.max(...Object.values(scale.steps).map((css) => coords(css).c));
		const neutral = (neutralChroma: number) =>
			generateScales(
				{ version: 1, seed: "#684dda", knobs: { neutralChroma } },
				{ appearance: "light" },
			).neutral;
		expect(peak(neutral(0))).toBe(0);
		expect(peak(neutral(0.01))).toBeCloseTo(0.01, 3);
		expect(peak(neutral(0.04))).toBeCloseTo(0.04, 3);
	});
});
