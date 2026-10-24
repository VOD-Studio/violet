import Color from "colorjs.io";
import { beforeAll, describe, expect, it } from "vitest";
import { type Appearance, type ContrastLevel, generateScales, type Scale } from "../index.ts";
import { apca, composite, coords, deltaE, hueDistance, parse, wcag } from "./colors.ts";
import { GATES, gateFailures, type MeasuredScale, measureSample } from "./gates.ts";
import {
	DEFAULT_NEUTRAL_CHROMA,
	describeTheme,
	expectNoFailures,
	namedScales,
	type Sample,
	STEPS,
	SWEEP_TIMEOUT,
	sweep,
	THEMES,
} from "./sweep.ts";

// CSS Color 4 在 OKLab 中以 0.02 作为可察觉阈值
const JUST_NOTICEABLE = 0.02;

const allColors = (scale: Scale) => [
	...Object.values(scale.steps),
	scale.contrast,
	...("alpha" in scale
		? Object.values((scale as Scale & { alpha: Record<number, string> }).alpha)
		: []),
];

/** 某一外观与对比度档位的遍历：对比度门槛，以及色域、单调、色相、实色与透明度的性质。 */
export function describeSweep(appearance: Appearance, contrast: ContrastLevel) {
	describe(`${appearance} 外观 ${contrast} 档遍历全部色相、色度与旋钮`, () => {
		let samples: Sample[];
		let measured: MeasuredScale[][];
		beforeAll(() => {
			samples = sweep(appearance, contrast);
			measured = samples.map(measureSample);
		}, SWEEP_TIMEOUT);

		it(`覆盖 ${THEMES.length} 个主题`, () => {
			expect(samples).toHaveLength(THEMES.length);
		});

		it.each(GATES)(
			"$name 同时通过 WCAG 2.2 与 APCA",
			(gate) => expectNoFailures(gateFailures(gate, samples, measured, contrast)),
			SWEEP_TIMEOUT,
		);

		it(
			"全部颜色落在 sRGB 内",
			() => {
				const failures = samples.flatMap((sample) =>
					namedScales(sample.scales).flatMap(([name, scale]) =>
						allColors(scale)
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
					namedScales(sample.scales).flatMap(([name, scale]) => {
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
					for (const [name, scale] of [
						["brand", sample.scales.brand],
						["neutral", sample.scales.neutral],
					] as const) {
						for (const css of Object.values(scale.steps)) {
							const color = coords(css);
							if (
								seed.c >= 0.002 &&
								color.c > 0 &&
								hueDistance(color.h, seed.h) > 0.01
							)
								failures.push(
									`${describeTheme(sample.theme)} ${name} ${css} 色相偏离`,
								);
							if (name === "neutral" && color.c > Math.min(knob, seed.c) + 1e-4)
								failures.push(
									`${describeTheme(sample.theme)} neutral ${css} 色度过高`,
								);
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
			"悬停态的文字对比度不低于常态，前景只取近白或近黑",
			() => {
				const failures = samples.flatMap((sample) =>
					namedScales(sample.scales).flatMap(
						([name, { contrast: foreground, steps }]) => {
							const { l } = coords(foreground);
							const problems: string[] = [];
							if (l < 0.95 && l > 0.25) problems.push("前景不是近白或近黑");
							if (
								wcag(foreground, steps[10]) < wcag(foreground, steps[9]) ||
								apca(foreground, steps[10]) < apca(foreground, steps[9])
							)
								problems.push(`悬停 ${steps[9]} → ${steps[10]} 降低了对比度`);
							return problems.map(
								(problem) =>
									`${describeTheme(sample.theme)} ${name} ${foreground} ${problem}`,
							);
						},
					),
				);
				expectNoFailures(failures);
			},
			SWEEP_TIMEOUT,
		);

		it(
			"透明度色阶叠在页面背景上，与对应实色档的色差低于可察觉阈值",
			() => {
				const failures: string[] = [];
				for (const sample of samples) {
					const background = sample.scales.neutral.steps[1];
					for (const [name, scale] of [
						["brand", sample.scales.brand],
						["neutral", sample.scales.neutral],
					] as const) {
						for (const step of STEPS) {
							const difference = deltaE(
								composite(scale.alpha[step], background),
								scale.steps[step],
							);
							if (difference >= JUST_NOTICEABLE)
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

		it(
			"结果可重复",
			() => {
				const subset = samples.filter((_, index) => index % 50 === 0);
				for (const { theme, scales } of subset)
					expect(
						generateScales(structuredClone(theme), { appearance, contrast }),
					).toEqual(scales);
			},
			SWEEP_TIMEOUT,
		);
	});
}
