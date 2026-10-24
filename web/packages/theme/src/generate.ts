import { toAlpha } from "./alpha.ts";
import {
	fitGamut,
	formatOklch,
	type Gamut,
	hexToOklch,
	type Oklch,
	relativeLuminance,
} from "./color.ts";
import {
	type Appearance,
	type AppearanceRules,
	type ContrastLevel,
	type Foreground,
	RULES,
	STATUS_SEEDS,
	type StatusName,
	type Targets,
} from "./rules.ts";
import { normalizeSeed, resolveKnobs, type Theme } from "./theme.ts";

export type { Appearance, ContrastLevel, StatusName } from "./rules.ts";

/**
 * 色阶档位，用途沿用 Radix Colors：1–2 背景，3–5 组件底色及其悬停、按下，
 * 6 装饰性分隔线，7–8 控件边界与焦点环，9–10 实色及其悬停，11 次要文字与链接，12 正文。
 * 除实色 9–10 锚定种子色外，各档亮度随档位单调远离背景。
 */
export type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/** 一条 12 档色阶，颜色为 CSS `oklch()` 字符串。 */
export interface Scale {
	steps: Readonly<Record<Step, string>>;
	/** 第 9、10 档实色上的前景文字色，在近白与近黑之间按对比度门槛自动选择 */
	contrast: string;
}

/** 带透明度色阶的色阶。 */
export interface AlphaScale extends Scale {
	/** 第 n 档叠在中性第 1 档（页面背景）上时，视觉等同于 `steps[n]` */
	alpha: Readonly<Record<Step, string>>;
}

/** 生成选项：外观、对比度档位与目标色域。 */
export interface GenerateOptions {
	appearance: Appearance;
	/**
	 * 对比度档位；`"more"` 供 `prefers-contrast: more` 使用，全部门槛整体上调。
	 *
	 * @default "standard"
	 */
	contrast?: ContrastLevel;
	/**
	 * 目标色域，超出时保持亮度与色相、只降色度。
	 *
	 * @default "srgb"
	 */
	gamut?: Gamut;
}

/** 某一外观与对比度档位下的全部色阶。 */
export interface ThemeScales {
	appearance: Appearance;
	/** 对比度档位，与 {@link Scale.contrast} 无关 */
	contrast: ContrastLevel;
	gamut: Gamut;
	/** 由种子色派生，第 9 档尽量等于种子色 */
	brand: AlphaScale;
	/** 色相跟随种子色，色度由旋钮 `neutralChroma` 控制 */
	neutral: AlphaScale;
	/** 色相固定、不随主题变化的危险、警告与成功色阶 */
	status: Readonly<Record<StatusName, Scale>>;
}

// 相邻档的最小亮度差（OKLab），保证单调且悬停、按下可辨
const BOUNDARY_HOVER = 0.03;
const SOLID_HOVER = 0.04;
const TEXT_GAP = 0.02;
const PRIMARY_GAP = 0.06;
// 求解亮度的精度，与输出的 4 位小数对齐
const PRECISION = 1e-4;
// 深色前景：近黑并略带色调；比纯黑亮一些，与实色并置时不显得生硬
const DARK_FOREGROUND = { l: 0.2, c: 0.02 };
// 状态色不随主题变化，对灰色参照背景求解；主题背景带色调时亮度略有出入，目标放大这一比例兜住
const FIXED_SCALE_MARGIN = 1.03;
const FOREGROUNDS: readonly Foreground[] = ["light", "dark"];
export const STEPS: readonly Step[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const contrastRatio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** 从 `from` 走向 `to`，返回第一个满足条件的亮度；全程都不满足时返回 `to`。 */
function search(from: number, to: number, passes: (l: number) => boolean): number {
	if (passes(from)) return from;
	let failing = from;
	let passing = to;
	while (Math.abs(passing - failing) > PRECISION) {
		const middle = (failing + passing) / 2;
		if (passes(middle)) passing = middle;
		else failing = middle;
	}
	return passing;
}

type Interval = readonly [low: number, high: number];

/** 满足条件的亮度区间；条件须只在亮度一端成立（单调），两端都不成立时返回 null。 */
function interval(passes: (l: number) => boolean): Interval | null {
	const [atBlack, atWhite] = [passes(0), passes(1)];
	if (atBlack && atWhite) return [0, 1];
	if (atBlack) return [0, search(1, 0, passes)];
	if (atWhite) return [search(0, 1, passes), 1];
	return null;
}

const intersect = (intervals: (Interval | null)[]): Interval | null =>
	intervals.reduce<Interval | null>(
		(acc, next) => {
			if (!acc || !next) return null;
			const [low, high] = [Math.max(acc[0], next[0]), Math.min(acc[1], next[1])];
			return low <= high ? [low, high] : null;
		},
		[0, 1],
	);

const clamp = (value: number, [low, high]: Interval) => Math.min(high, Math.max(low, value));

interface ScaleContext {
	rules: AppearanceRules;
	targets: Targets;
	gamut: Gamut;
	hue: number;
	/** 色度曲线乘数：品牌与状态为种子色度，中性为 min(旋钮, 种子色度) */
	chroma: number;
	curve: readonly number[];
	/** 实色与背景至少要达到的比值 */
	separation: number;
}

/** 承载文字的背景的相对亮度。 */
interface Surfaces {
	/** 第 1–2 档：背景与表面 */
	page: number[];
	/** 第 3–5 档：组件底色及其悬停、按下 */
	component: number[];
}

const colorAt = (context: ScaleContext, step: Step, l: number): Oklch =>
	fitGamut(l, context.chroma * (context.curve[step - 1] ?? 0), context.hue, context.gamut);

const worstContrast = (color: Oklch, surfaces: number[]) => {
	const luminance = relativeLuminance(color);
	return Math.min(...surfaces.map((surface) => contrastRatio(luminance, surface)));
};

function subtleSteps(context: ScaleContext): Oklch[] {
	const { background, direction } = context.rules;
	const { offsets } = context.targets;
	return [
		colorAt(context, 1, background),
		...offsets.map((offset, index) =>
			colorAt(context, (index + 2) as Step, background + direction * offset),
		),
	];
}

const surfacesOf = (scales: Oklch[][]): Surfaces => {
	const luminances = (indices: number[]) =>
		indices.flatMap((index) => scales.map((steps) => relativeLuminance(steps[index] as Oklch)));
	return { page: luminances([0, 1]), component: luminances([2, 3, 4]) };
};

/** 边框与文字档（第 7、8、11、12 档）的亮度，按对比度目标单调远离背景。 */
function ladder(context: ScaleContext, subtle: Oklch[], surfaces: Surfaces) {
	const { background, direction, limit } = context.rules;
	const { targets } = context;
	const solve = (step: Step, from: number, goals: [number[], number][]) =>
		search(from, limit, (l) => {
			const color = colorAt(context, step, l);
			return goals.every(([on, target]) => worstContrast(color, on) >= target);
		});
	const l7 = solve(7, (subtle.at(-1)?.l ?? background) + direction * PRECISION, [
		[surfaces.page, targets.boundary],
	]);
	const l8 = l7 + direction * BOUNDARY_HOVER;
	const l11 = solve(11, l8 + direction * TEXT_GAP, [
		[surfaces.page, targets.secondary],
		[surfaces.component, targets.secondaryOnComponent],
	]);
	const l12 = solve(12, l11 + direction * PRIMARY_GAP, [
		[surfaces.page, targets.primary],
		[surfaces.component, targets.primaryOnComponent],
	]);
	return { l7, l8, l11, l12 };
}

interface SolidOption {
	foreground: Foreground;
	color: Oklch;
	/** 第 10 档相对第 9 档的亮度偏移：白字时变暗、深字时变亮，悬停态的文字对比度只升不降 */
	hover: number;
	range: Interval;
}

/** 每种前景下实色第 9 档可取的亮度区间：其上文字达标，且与背景可辨。 */
function solidOptions(context: ScaleContext, page: number[]): SolidOption[] {
	const { targets } = context;
	const colors: Record<Foreground, Oklch> = {
		light: { l: 1, c: 0, h: 0 },
		dark: fitGamut(
			DARK_FOREGROUND.l,
			Math.min(context.chroma, DARK_FOREGROUND.c),
			context.hue,
			context.gamut,
		),
	};
	return FOREGROUNDS.flatMap((foreground) => {
		const text = relativeLuminance(colors[foreground]);
		const hover = foreground === "light" ? -SOLID_HOVER : SOLID_HOVER;
		const legible = (step: Step, l: number) =>
			contrastRatio(text, relativeLuminance(colorAt(context, step, l))) >=
			targets.onSolid[foreground];
		const separated = (step: Step, l: number) =>
			worstContrast(colorAt(context, step, l), page) >= context.separation;
		const range = intersect([
			[Math.max(0, -hover), Math.min(1, 1 - hover)],
			interval((l) => legible(9, l)),
			interval((l) => legible(10, l + hover)),
			interval((l) => separated(9, l)),
			interval((l) => separated(10, l + hover)),
		]);
		return range ? [{ foreground, color: colors[foreground], hover, range }] : [];
	});
}

interface Solid {
	l9: number;
	l10: number;
	contrast: Oklch;
}

/** 取所需移动最小的前景；门槛保证至少一种前景可行，遍历测试覆盖全部色相与色度，兜底只为不抛错。 */
function pickSolid(options: SolidOption[], preferred: number): Solid {
	const ranked = options
		.map((option) => ({ option, l: clamp(preferred, option.range) }))
		.sort((a, b) => Math.abs(a.l - preferred) - Math.abs(b.l - preferred));
	const best = ranked[0];
	if (!best)
		return { l9: preferred, l10: preferred - SOLID_HOVER, contrast: { l: 1, c: 0, h: 0 } };
	return { l9: best.l, l10: best.l + best.option.hover, contrast: best.option.color };
}

type Ladder = ReturnType<typeof ladder>;

function toScale(
	context: ScaleContext,
	subtle: Oklch[],
	{ l7, l8, l11, l12 }: Ladder,
	solid: Solid,
) {
	const strong = [l7, l8, solid.l9, solid.l10, l11, l12];
	const colors = [
		...subtle,
		...strong.map((l, index) => colorAt(context, (index + 7) as Step, l)),
	];
	const steps = Object.fromEntries(
		STEPS.map((step) => [step, formatOklch(colors[step - 1] as Oklch)]),
	) as Record<Step, string>;
	return { colors, scale: { steps, contrast: formatOklch(solid.contrast) } };
}

/** 一条独立色阶：实色档优先取 `preferred`（种子色亮度），过不了门槛时只移到最近的可行亮度。 */
function buildScale(context: ScaleContext, subtle: Oklch[], surfaces: Surfaces, preferred: number) {
	const solid = pickSolid(solidOptions(context, surfaces.page), preferred);
	return {
		...toScale(context, subtle, ladder(context, subtle, surfaces), solid),
		solid: solid.l9,
	};
}

const amplify = (targets: Targets, factor: number): Targets => ({
	...targets,
	boundary: targets.boundary * factor,
	secondary: targets.secondary * factor,
	primary: targets.primary * factor,
	secondaryOnComponent: targets.secondaryOnComponent * factor,
	primaryOnComponent: targets.primaryOnComponent * factor,
	separation: targets.separation * factor,
});

interface FixedScales {
	status: Record<StatusName, Scale>;
}

const fixedCache = new Map<string, FixedScales>();

/** 状态色不随主题变化，对灰色参照背景求解，按外观、档位与色域缓存。 */
function fixedScales(appearance: Appearance, contrast: ContrastLevel, gamut: Gamut): FixedScales {
	const key = `${appearance}:${contrast}:${gamut}`;
	const cached = fixedCache.get(key);
	if (cached) return cached;
	const rules = RULES[appearance];
	const targets = amplify(rules.targets[contrast], FIXED_SCALE_MARGIN);
	const base = {
		rules,
		targets,
		gamut,
		curve: rules.brandChroma,
		separation: targets.separation,
	};
	const reference = subtleSteps({ ...base, hue: 0, chroma: 0 });

	const status = Object.fromEntries(
		(Object.keys(STATUS_SEEDS) as StatusName[]).map((name) => {
			const seed = hexToOklch(STATUS_SEEDS[name]);
			const context: ScaleContext = { ...base, hue: seed.h, chroma: seed.c };
			const subtle = subtleSteps(context);
			return [
				name,
				buildScale(context, subtle, surfacesOf([reference, subtle]), seed.l).scale,
			];
		}),
	) as Record<StatusName, Scale>;
	const fixed = { status };
	fixedCache.set(key, fixed);
	return fixed;
}

const toAlphaSteps = (colors: Oklch[], background: Oklch, gamut: Gamut) =>
	Object.fromEntries(
		STEPS.map((step) => [step, toAlpha(colors[step - 1] as Oklch, background, gamut)]),
	) as Record<Step, string>;

/**
 * 由主题生成某一外观与对比度档位下的全部色阶：品牌与中性（各带透明度色阶）以及状态色。
 *
 * 背景、边框与文字档按对背景的目标对比度反解亮度并单调远离背景；实色档锚定种子色。文字、实色前景与控件边界
 * 同时满足 WCAG 2.2 AA 与 APCA 门槛，全部颜色落在目标色域内。纯函数，相同输入得到逐字相同的输出。
 *
 * @param theme - 不可信输入请先经 {@link normalizeTheme}；缺省的旋钮取默认值
 * @throws TypeError 种子色不是 `#rgb` / `#rrggbb`
 * @example
 * ```ts
 * const light = generateScales({ version: 1, seed: "#684dda" }, { appearance: "light" });
 * light.brand.steps[9]; // "oklch(0.5307 0.2048 285.88)"，即种子色本身
 * ```
 */
export function generateScales(theme: Theme, options: GenerateOptions): ThemeScales {
	const seedHex = normalizeSeed(theme.seed);
	if (seedHex === null) throw new TypeError(`Invalid seed color: ${String(theme.seed)}`);
	const { appearance, contrast = "standard", gamut = "srgb" } = options;
	const rules = RULES[appearance];
	const targets = rules.targets[contrast];
	// 用种子色的原始坐标：先按输出精度取整会把落在 sRGB 棱上的种子色推出色域，连带压低整条色阶的色度
	const seed = hexToOklch(seedHex);
	const knobs = resolveKnobs(theme.knobs);

	const base = { rules, targets, gamut, hue: seed.h, separation: targets.separation };
	const brand: ScaleContext = { ...base, chroma: seed.c, curve: rules.brandChroma };
	const neutral: ScaleContext = {
		...base,
		chroma: Math.min(knobs.neutralChroma, seed.c),
		curve: rules.neutralChroma,
	};
	const brandSubtle = subtleSteps(brand);
	const neutralSubtle = subtleSteps(neutral);
	const surfaces = surfacesOf([brandSubtle, neutralSubtle]);

	const brandBuilt = buildScale(brand, brandSubtle, surfaces, seed.l);
	// 中性实色与品牌实色取同一亮度，两者并列时分量一致
	const neutralBuilt = buildScale(neutral, neutralSubtle, surfaces, brandBuilt.solid);
	const background = neutralSubtle[0] as Oklch;
	return {
		appearance,
		contrast,
		gamut,
		brand: { ...brandBuilt.scale, alpha: toAlphaSteps(brandBuilt.colors, background, gamut) },
		neutral: {
			...neutralBuilt.scale,
			alpha: toAlphaSteps(neutralBuilt.colors, background, gamut),
		},
		...fixedScales(appearance, contrast, gamut),
	};
}
