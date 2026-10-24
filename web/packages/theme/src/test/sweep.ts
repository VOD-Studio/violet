import { expect } from "vitest";
import {
	type Appearance,
	type ContrastLevel,
	generateScales,
	normalizeTheme,
	type Scale,
	type Step,
	type Theme,
	type ThemeScales,
} from "../index.ts";
import { seedHex } from "./colors.ts";

export const STEPS: readonly Step[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
export const APPEARANCES: readonly Appearance[] = ["light", "dark"];
export const LEVELS: readonly ContrastLevel[] = ["standard", "more"];
/** 外观 × 对比度档位的全部组合。 */
export const COMBINATIONS = APPEARANCES.flatMap((appearance) =>
	LEVELS.map((contrast) => ({ appearance, contrast })),
);
export const DEFAULT_NEUTRAL_CHROMA = normalizeTheme(undefined).knobs.neutralChroma;
// 单个外观约两万次生成与逐对比较
export const SWEEP_TIMEOUT = 120_000;

// 色度从近灰到超出 sRGB（超出部分按色域映射收回边界，即各色相能达到的最高色度）
const CHROMAS = [0.01, 0.04, 0.08, 0.12, 0.16, 0.2, 0.25, 0.3, 0.4];
// 种子亮度覆盖很暗到很浅，让实色档在两种外观下都经历保留与调整
const LIGHTNESSES = [0.2, 0.4, 0.55, 0.7, 0.85, 0.97];
const GRAYS = ["#000000", "#ffffff", "#808080", "#1a1a1a", "#e5e5e5"];
// 旋钮取合法范围两端
const NEUTRAL_CHROMA_EXTREMES = [0, 0.05];

/** 遍历全部色相（步长 1°）× 色度 × 种子亮度得到的去重种子色。 */
export const SEEDS: readonly string[] = [
	...new Set([
		...GRAYS,
		...Array.from({ length: 360 }, (_, hue) =>
			CHROMAS.flatMap((chroma) =>
				LIGHTNESSES.map((lightness) => seedHex(lightness, chroma, hue)),
			),
		).flat(),
	]),
];

/** 全部种子色取默认旋钮，每三个种子色再各取一次旋钮的两端。 */
export const THEMES: readonly Theme[] = [
	...SEEDS.map((seed): Theme => ({ version: 1, seed })),
	...SEEDS.filter((_, index) => index % 3 === 0).flatMap((seed) =>
		NEUTRAL_CHROMA_EXTREMES.map(
			(neutralChroma): Theme => ({ version: 1, seed, knobs: { neutralChroma } }),
		),
	),
];

export interface Sample {
	theme: Theme;
	scales: ThemeScales;
}

export const sweep = (appearance: Appearance, contrast: ContrastLevel = "standard"): Sample[] =>
	THEMES.map((theme) => ({ theme, scales: generateScales(theme, { appearance, contrast }) }));

/** 全部色阶及其名称：品牌、中性与三种状态色。 */
export const namedScales = (scales: ThemeScales): [name: string, scale: Scale][] => [
	["brand", scales.brand],
	["neutral", scales.neutral],
	...Object.entries(scales.status),
];

export const describeTheme = ({ seed, knobs }: Theme) =>
	knobs?.neutralChroma === undefined ? seed : `${seed} neutralChroma=${knobs.neutralChroma}`;

/** 失败时列出前 20 条，便于调参时定位。 */
export const expectNoFailures = (failures: string[]) =>
	expect(failures.slice(0, 20), `${failures.length} failures`).toEqual([]);
