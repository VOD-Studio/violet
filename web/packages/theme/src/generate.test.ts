// @vitest-environment node
import Color from "colorjs.io";
import { beforeAll, describe, expect, it } from "vitest";
import { type Appearance, generateScales, type Scale } from "./index.ts";
import { apca, composite, deltaE, parse, toHex, wcag } from "./test/colors.ts";
import {
	APPEARANCES,
	DEFAULT_NEUTRAL_CHROMA,
	describeTheme,
	expectNoFailures,
	type Sample,
	STEPS,
	SWEEP_TIMEOUT,
	sweep,
} from "./test/sweep.ts";

// colorjs 以 null 表示无色相
const coords = (css: string) => {
	const [l, c, h] = parse(css).coords.map((value) =>
		value === null || Number.isNaN(value) ? 0 : value,
	);
	return { l: l ?? 0, c: c ?? 0, h: h ?? 0 };
};
const hueDistance = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
const scalesOf = (sample: Sample) => [
	["brand", sample.scales.brand] as const,
	["neutral", sample.scales.neutral] as const,
];

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

describe.each(APPEARANCES)("%s 外观遍历全部色相、色度与旋钮", (appearance) => {
	let samples: Sample[];
	beforeAll(() => {
		samples = sweep(appearance);
	}, SWEEP_TIMEOUT);

	it(
		"全部颜色落在 sRGB 内",
		() => {
			const failures = samples.flatMap((sample) =>
				scalesOf(sample).flatMap(([name, scale]) =>
					[...Object.values(scale.steps), scale.contrast, ...Object.values(scale.alpha)]
						.filter((css) => !parse(css).inGamut("srgb"))
						.map((css) => `${describeTheme(sample.theme)} ${name} ${css}`),
				),
			);
			expectNoFailures(failures);
		},
		SWEEP_TIMEOUT,
	);

	it(
		"除实色 9–10 外，各档亮度单调远离背景",
		() => {
			const failures = samples.flatMap((sample) =>
				scalesOf(sample).flatMap(([name, scale]) => {
					const lightness = STEPS.filter((step) => step !== 9 && step !== 10).map(
						(step) => coords(scale.steps[step]).l,
					);
					const monotonic = lightness.every(
						(l, index) =>
							index === 0 ||
							(appearance === "light"
								? l < (lightness[index - 1] ?? 0)
								: l > (lightness[index - 1] ?? 1)),
					);
					return monotonic
						? []
						: [`${describeTheme(sample.theme)} ${name} ${lightness.join(" ")}`];
				}),
			);
			expectNoFailures(failures);
		},
		SWEEP_TIMEOUT,
	);

	it(
		"品牌色阶保持种子色相，中性色阶跟随品牌色相且色度不超过旋钮与种子色度",
		() => {
			const failures: string[] = [];
			for (const sample of samples) {
				const seed = coords(new Color(sample.theme.seed).to("oklch").toString());
				const knob = sample.theme.knobs?.neutralChroma ?? DEFAULT_NEUTRAL_CHROMA;
				for (const [name, scale] of scalesOf(sample)) {
					for (const css of Object.values(scale.steps)) {
						const color = coords(css);
						if (seed.c >= 0.002 && color.c > 0 && hueDistance(color.h, seed.h) > 0.01)
							failures.push(`${describeTheme(sample.theme)} ${name} ${css} 色相偏离`);
						if (name === "neutral" && color.c > Math.min(knob, seed.c) + 1e-4)
							failures.push(`${describeTheme(sample.theme)} neutral ${css} 色度过高`);
					}
				}
			}
			expectNoFailures(failures);
		},
		SWEEP_TIMEOUT,
	);

	it(
		"实色档只调整亮度：色相不变，色度只在超出色域时降低",
		() => {
			const failures: string[] = [];
			for (const sample of samples) {
				const seed = coords(new Color(sample.theme.seed).to("oklch").toString());
				const solid = coords(sample.scales.brand.steps[9]);
				if (seed.c >= 0.002 && hueDistance(solid.h, seed.h) > 0.01)
					failures.push(`${sample.theme.seed} 色相 ${solid.h}`);
				if (solid.c > seed.c + 1e-4)
					failures.push(`${sample.theme.seed} 色度升高 ${solid.c}`);
				const roomier = new Color("oklch", [solid.l, solid.c + 0.002, seed.h]);
				if (solid.c < seed.c - 0.002 && roomier.inGamut("srgb"))
					failures.push(`${sample.theme.seed} 色度无故降低 ${solid.c} < ${seed.c}`);
			}
			expectNoFailures(failures);
		},
		SWEEP_TIMEOUT,
	);

	it(
		"悬停态的文字对比度不低于常态",
		() => {
			const failures = samples.flatMap((sample) =>
				scalesOf(sample)
					.filter(
						([, { contrast, steps }]) =>
							wcag(contrast, steps[10]) < wcag(contrast, steps[9]) ||
							apca(contrast, steps[10]) < apca(contrast, steps[9]),
					)
					.map(
						([name, { contrast, steps }]) =>
							`${describeTheme(sample.theme)} ${name} ${contrast} on ${steps[9]} → ${steps[10]}`,
					),
			);
			expectNoFailures(failures);
		},
		SWEEP_TIMEOUT,
	);

	it(
		"实色上的前景只取近白或近黑",
		() => {
			const failures = samples.flatMap((sample) =>
				scalesOf(sample)
					.filter(([, scale]) => {
						const { l } = coords(scale.contrast);
						return l < 0.95 && l > 0.25;
					})
					.map(
						([name, scale]) =>
							`${describeTheme(sample.theme)} ${name} ${scale.contrast}`,
					),
			);
			expectNoFailures(failures);
		},
		SWEEP_TIMEOUT,
	);

	it(
		"透明度色阶叠在页面背景上，与对应实色档的色差低于可察觉阈值",
		() => {
			// CSS Color 4 在 OKLab 中以 0.02 作为可察觉阈值
			const failures: string[] = [];
			for (const sample of samples) {
				const background = sample.scales.neutral.steps[1];
				for (const [name, scale] of scalesOf(sample)) {
					for (const step of STEPS) {
						const difference = deltaE(
							composite(scale.alpha[step], background),
							scale.steps[step],
						);
						if (difference >= 0.02)
							failures.push(
								`${describeTheme(sample.theme)} ${name}-a${step} ${scale.alpha[step]}: ΔE ${difference.toFixed(4)}`,
							);
					}
				}
			}
			expectNoFailures(failures);
		},
		SWEEP_TIMEOUT,
	);

	it("结果可重复", () => {
		const subset = samples.filter((_, index) => index % 50 === 0);
		for (const { theme, scales } of subset)
			expect(generateScales(structuredClone(theme), { appearance })).toEqual(scales);
	});
});
