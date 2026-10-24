import {
	fitGamut,
	formatOklch,
	type Gamut,
	hexToOklch,
	type Oklch,
	relativeLuminance,
} from "./color.ts";
import { normalizeSeed, resolveKnobs, type Theme } from "./theme.ts";

/** 外观：浅色或深色。 */
export type Appearance = "light" | "dark";

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

/** 生成选项：外观与目标色域。 */
export interface GenerateOptions {
	appearance: Appearance;
	/**
	 * 目标色域，超出时保持亮度与色相、只降色度。
	 *
	 * @default "srgb"
	 */
	gamut?: Gamut;
}

/** 某一外观下的全部色阶。 */
export interface ThemeScales {
	appearance: Appearance;
	gamut: Gamut;
	/** 由种子色派生，第 9 档尽量等于种子色 */
	brand: Scale;
	/** 色相跟随种子色，色度由旋钮 `neutralChroma` 控制 */
	neutral: Scale;
}

interface Rules {
	/** 远离背景的亮度方向：浅色向暗为 -1，深色向亮为 1 */
	direction: -1 | 1;
	/** 第 1 档（页面背景）的亮度 */
	background: number;
	/** 第 2–6 档相对第 1 档的亮度差，按观感取值，不由对比度反解 */
	offsets: readonly [number, number, number, number, number];
	/** 第 12 档能到达的最远亮度 */
	limit: number;
	/**
	 * 求解用的 WCAG 比值目标，对相应背景取最差值。WCAG 门槛留约 2% 余量吸收取整与 8 位量化；
	 * APCA 门槛折算成 WCAG 比值后按遍历测试校准，取两者较大者。深色下 APCA 更严，所以两种外观的数值不对称。
	 */
	targets: {
		/** 控件边界与焦点环对背景与表面：WCAG 3，APCA Lc 30 */
		boundary: number;
		/** 次要文字与链接对背景与表面：WCAG 4.5，APCA Lc 75 */
		secondary: number;
		/** 正文对背景与表面：WCAG 4.5，APCA Lc 90 */
		primary: number;
		/** 次要文字与链接对组件底色：WCAG 4.5，APCA Lc 60 */
		secondaryOnComponent: number;
		/** 正文对组件底色：WCAG 4.5，APCA Lc 75 */
		primaryOnComponent: number;
		/** 实色上的前景，按前景取值：WCAG 4.5，APCA Lc 60 */
		onSolid: Readonly<Record<Foreground, number>>;
		/** 实色与背景可辨：APCA Lc 15。带文字的按钮在 WCAG 1.4.11 下不要求填充色与页面的对比度 */
		separation: number;
	};
	/** 品牌色阶各档色度相对种子色度的比例 */
	brandChroma: readonly number[];
	/** 中性色阶各档色度相对 `neutralChroma` 的比例 */
	neutralChroma: readonly number[];
}

type Foreground = "light" | "dark";

const RULES: Record<Appearance, Rules> = {
	light: {
		direction: -1,
		background: 0.992,
		offsets: [0.012, 0.035, 0.058, 0.08, 0.11],
		limit: 0.15,
		targets: {
			boundary: 3.06,
			secondary: 6.4,
			primary: 11.4,
			secondaryOnComponent: 4.6,
			primaryOnComponent: 8,
			onSolid: { light: 4.59, dark: 8.8 },
			separation: 1.4,
		},
		brandChroma: [0.02, 0.05, 0.1, 0.18, 0.26, 0.36, 0.6, 0.75, 1, 1, 0.9, 0.5],
		neutralChroma: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.85, 0.9, 1, 1, 0.9, 0.7],
	},
	dark: {
		direction: 1,
		background: 0.17,
		offsets: [0.035, 0.075, 0.105, 0.135, 0.175],
		limit: 0.985,
		targets: {
			boundary: 4.3,
			secondary: 11.6,
			primary: 14.9,
			secondaryOnComponent: 7.6,
			primaryOnComponent: 9.8,
			onSolid: { light: 4.59, dark: 8.8 },
			separation: 2.55,
		},
		brandChroma: [0.1, 0.16, 0.3, 0.42, 0.5, 0.55, 0.65, 0.8, 1, 0.95, 0.7, 0.3],
		neutralChroma: [0.35, 0.45, 0.55, 0.6, 0.65, 0.7, 0.85, 0.9, 1, 1, 0.9, 0.6],
	},
};

// 相邻档的最小亮度差（OKLab），保证单调且悬停、按下可辨
const BOUNDARY_HOVER = 0.03;
const SOLID_HOVER = 0.04;
const TEXT_GAP = 0.02;
const PRIMARY_GAP = 0.06;
// 求解亮度的精度，与输出的 4 位小数对齐
const PRECISION = 1e-4;
// 深色前景：近黑并略带品牌色调；比纯黑亮一些，与实色并置时不显得生硬
const DARK_FOREGROUND = { l: 0.2, c: 0.02 };
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

interface ScaleContext {
	rules: Rules;
	gamut: Gamut;
	hue: number;
	/** 色度曲线乘数：品牌为种子色度，中性为 min(旋钮, 种子色度) */
	chroma: number;
	curve: readonly number[];
}

/** 承载文字的背景的相对亮度。 */
interface Surfaces {
	/** 两条色阶的第 1–2 档：背景与表面 */
	page: number[];
	/** 两条色阶的第 3–5 档：组件底色及其悬停、按下 */
	component: number[];
}

const colorAt = (context: ScaleContext, step: Step, l: number): Oklch =>
	fitGamut(l, context.chroma * (context.curve[step - 1] ?? 0), context.hue, context.gamut);

const worstContrast = (color: Oklch, surfaces: number[]) => {
	const luminance = relativeLuminance(color);
	return Math.min(...surfaces.map((surface) => contrastRatio(luminance, surface)));
};

function subtleSteps(context: ScaleContext): Oklch[] {
	const { background, direction, offsets } = context.rules;
	return [
		colorAt(context, 1, background),
		...offsets.map((offset, index) =>
			colorAt(context, (index + 2) as Step, background + direction * offset),
		),
	];
}

/**
 * 求实色档。第 9 档优先取 `preferred`（种子色亮度），过不了门槛时只移到最近的可行亮度，
 * 前景在近白与近黑中取所需移动更小的一个；第 10 档朝前景对比度更高的方向偏移。实色不参与其余档位的亮度排序。
 */
function solidSteps(context: ScaleContext, page: number[], preferred: number) {
	const { targets } = context.rules;
	const foregrounds: Record<Foreground, Oklch> = {
		light: { l: 1, c: 0, h: 0 },
		dark: fitGamut(
			DARK_FOREGROUND.l,
			Math.min(context.chroma, DARK_FOREGROUND.c),
			context.hue,
			context.gamut,
		),
	};
	const options = FOREGROUNDS.flatMap((foreground) => {
		const text = relativeLuminance(foregrounds[foreground]);
		// 白字时悬停变暗、深字时悬停变亮，悬停态的文字对比度只升不降
		const hover = foreground === "light" ? -SOLID_HOVER : SOLID_HOVER;
		const legible = (step: Step, l: number) =>
			contrastRatio(text, relativeLuminance(colorAt(context, step, l))) >=
			targets.onSolid[foreground];
		const separated = (step: Step, l: number) =>
			worstContrast(colorAt(context, step, l), page) >= targets.separation;
		const inRange = preferred + hover >= 0 && preferred + hover <= 1;
		const kept =
			inRange &&
			legible(9, preferred) &&
			legible(10, preferred + hover) &&
			separated(9, preferred) &&
			separated(10, preferred + hover);
		if (kept) return [{ foreground, l: preferred, hover, distance: 0 }];
		const range = intersect([
			[Math.max(0, -hover), Math.min(1, 1 - hover)],
			interval((l) => legible(9, l)),
			interval((l) => legible(10, l + hover)),
			interval((l) => separated(9, l)),
			interval((l) => separated(10, l + hover)),
		]);
		if (!range) return [];
		const l = Math.min(range[1], Math.max(range[0], preferred));
		return [{ foreground, l, hover, distance: Math.abs(l - preferred) }];
	});
	// 门槛保证至少一种前景可行，遍历测试覆盖全部色相与色度；此处兜底只为不抛错
	const chosen = options.sort((a, b) => a.distance - b.distance)[0] ?? {
		foreground: "light" as const,
		l: preferred,
		hover: -SOLID_HOVER,
	};
	return { l9: chosen.l, l10: chosen.l + chosen.hover, contrast: foregrounds[chosen.foreground] };
}

/** 求第 7–12 档：边框与文字档按对比度目标单调远离背景，实色档见 {@link solidSteps}。 */
function strongSteps(
	context: ScaleContext,
	subtle: Oklch[],
	surfaces: Surfaces,
	preferred: number,
) {
	const { background, direction, limit, targets } = context.rules;
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
	const { l9, l10, contrast } = solidSteps(context, surfaces.page, preferred);
	return {
		steps: [l7, l8, l9, l10, l11, l12].map((l, index) =>
			colorAt(context, (index + 7) as Step, l),
		),
		contrast,
		solid: l9,
	};
}

const toScale = (steps: Oklch[], contrast: Oklch): Scale => ({
	steps: Object.fromEntries(
		STEPS.map((step) => [step, formatOklch(steps[step - 1] as Oklch)]),
	) as Record<Step, string>,
	contrast: formatOklch(contrast),
});

/**
 * 由主题生成某一外观下的品牌与中性色阶。
 *
 * 边框与文字档按对背景的目标对比度反解亮度，与背景档一起单调远离背景；实色档锚定种子色。文字、实色前景
 * 与控件边界同时满足 WCAG 2.2 AA 与 APCA 门槛，全部颜色落在目标色域内。纯函数，相同输入得到逐字相同的输出。
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
	const { appearance, gamut = "srgb" } = options;
	const rules = RULES[appearance];
	// 用种子色的原始坐标：先按输出精度取整会把落在 sRGB 棱上的种子色推出色域，连带压低整条色阶的色度
	const seed = hexToOklch(seedHex);
	const knobs = resolveKnobs(theme.knobs);

	const brand: ScaleContext = {
		rules,
		gamut,
		hue: seed.h,
		chroma: seed.c,
		curve: rules.brandChroma,
	};
	const neutral: ScaleContext = {
		rules,
		gamut,
		hue: seed.h,
		chroma: Math.min(knobs.neutralChroma, seed.c),
		curve: rules.neutralChroma,
	};
	const brandSubtle = subtleSteps(brand);
	const neutralSubtle = subtleSteps(neutral);
	const luminances = (indices: number[]) =>
		indices
			.flatMap((index) => [brandSubtle[index], neutralSubtle[index]])
			.map((color) => relativeLuminance(color as Oklch));
	const surfaces: Surfaces = { page: luminances([0, 1]), component: luminances([2, 3, 4]) };

	const brandStrong = strongSteps(brand, brandSubtle, surfaces, seed.l);
	// 中性实色与品牌实色取同一亮度，两者并列时分量一致
	const neutralStrong = strongSteps(neutral, neutralSubtle, surfaces, brandStrong.solid);
	return {
		appearance,
		gamut,
		brand: toScale([...brandSubtle, ...brandStrong.steps], brandStrong.contrast),
		neutral: toScale([...neutralSubtle, ...neutralStrong.steps], neutralStrong.contrast),
	};
}
