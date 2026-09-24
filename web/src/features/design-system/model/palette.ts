import { getContrastRatio, getWcagRating, oklchToRgb } from "@shared/lib/color-math";

/**
 * 色板生成器：选定一个主色（色相 + 彩度种子），推导完整色板——
 * 品牌色阶、主色与强调角色、功能色、中性带。这是「色板可插拔」
 * 的机制化：换色 = 换种子重跑本算法。
 */

export interface SeedColor {
	/** 色相角 0..360 */
	h: number;
	/** 彩度 0.06..0.30（克制上限，过饱和不入界面） */
	c: number;
}

export interface SwatchColor {
	oklch: string;
	hex: string;
}

export interface RampStep {
	/** 色阶号（50..950） */
	label: string;
	oklch: string;
	hex: string;
}

export interface RoleColor {
	role: string;
	light: SwatchColor;
	dark: SwatchColor;
	/** 用途说明 */
	note?: string;
}

export interface ContrastAudit {
	pair: string;
	ratio: number;
	rating: string;
	pass: boolean;
}

export interface FunctionalColorSet {
	key: "info" | "success" | "warning" | "destructive";
	name: string;
	note: string;
	light: {
		solid: SwatchColor;
		foreground: SwatchColor;
		wash: SwatchColor;
		washForeground: SwatchColor;
		border: SwatchColor;
	};
	dark: {
		solid: SwatchColor;
		foreground: SwatchColor;
		wash: SwatchColor;
		washForeground: SwatchColor;
		border: SwatchColor;
	};
}

export interface GeneratedPalette {
	seed: SeedColor;
	/** 品牌色阶 ×11（浅到深） */
	ramp: RampStep[];
	/** 主色与强调：primary/accent 系标准语义 token,每行独立值 */
	primaryRoles: RoleColor[];
	/** 功能色:行为状态语义,固定不随色板推导 */
	functional: RoleColor[];
	/** 完整功能色体系（实色、洗染面、文字与边框） */
	functionalSets: FunctionalColorSet[];
	/** 中性带 */
	neutral: RoleColor[];
	/** 对比度审计 */
	audits: ContrastAudit[];
}

const clamp = (x: number, min: number, max: number) => Math.min(Math.max(x, min), max);

function swatch(l: number, c: number, h: number): SwatchColor {
	const oklch = `oklch(${Number(l.toFixed(3))} ${Number(c.toFixed(3))} ${Number(h.toFixed(1))})`;
	return { oklch, hex: oklchToRgb(l, c, h).hex };
}

/**
 * 完整功能色体系：行为状态语义，不随种子色板更迭。
 * 告别机械的统一度数，采用符合现代感知色彩科学（OKLCH）的非对称调优：
 * 警示色用温润流金的琥珀金（杜绝恶心泥浆褐黄），成功色用清爽透亮的翡翠绿，
 * 危险色用雅致鲜明的赤绯红，信息色用清澈蔚蓝。
 * 同时齐备实色（Solid）、前景色（Foreground）、洗染面（Wash）与描边（Border）。
 */
export const FUNCTIONAL_SETS: FunctionalColorSet[] = [
	{
		key: "info",
		name: "信息",
		note: "客观提示",
		light: {
			solid: swatch(0.61, 0.15, 240),
			foreground: swatch(0.99, 0, 0),
			wash: swatch(0.975, 0.015, 240),
			washForeground: swatch(0.4, 0.12, 240),
			border: swatch(0.91, 0.035, 240),
		},
		dark: {
			solid: swatch(0.74, 0.145, 240),
			foreground: swatch(0.16, 0.04, 240),
			wash: swatch(0.2, 0.035, 240),
			washForeground: swatch(0.9, 0.06, 240),
			border: swatch(0.28, 0.05, 240),
		},
	},
	{
		key: "success",
		name: "成功",
		note: "达成反馈",
		light: {
			solid: swatch(0.62, 0.145, 158),
			foreground: swatch(0.99, 0, 0),
			wash: swatch(0.975, 0.02, 158),
			washForeground: swatch(0.38, 0.12, 158),
			border: swatch(0.91, 0.04, 158),
		},
		dark: {
			solid: swatch(0.75, 0.15, 158),
			foreground: swatch(0.15, 0.03, 158),
			wash: swatch(0.2, 0.035, 158),
			washForeground: swatch(0.9, 0.07, 158),
			border: swatch(0.28, 0.05, 158),
		},
	},
	{
		key: "warning",
		name: "警示",
		note: "待决提醒",
		light: {
			solid: swatch(0.66, 0.155, 60),
			foreground: swatch(0.99, 0, 0),
			wash: swatch(0.975, 0.02, 60),
			washForeground: swatch(0.42, 0.12, 60),
			border: swatch(0.91, 0.04, 60),
		},
		dark: {
			solid: swatch(0.77, 0.15, 65),
			foreground: swatch(0.16, 0.03, 75),
			wash: swatch(0.22, 0.04, 65),
			washForeground: swatch(0.9, 0.07, 65),
			border: swatch(0.3, 0.05, 65),
		},
	},
	{
		key: "destructive",
		name: "危险",
		note: "操作阻断",
		light: {
			solid: swatch(0.58, 0.195, 20),
			foreground: swatch(0.99, 0, 0),
			wash: swatch(0.975, 0.015, 20),
			washForeground: swatch(0.42, 0.15, 20),
			border: swatch(0.91, 0.035, 20),
		},
		dark: {
			solid: swatch(0.69, 0.18, 18),
			foreground: swatch(0.99, 0, 0),
			wash: swatch(0.2, 0.035, 18),
			washForeground: swatch(0.9, 0.06, 18),
			border: swatch(0.28, 0.05, 18),
		},
	},
];

/** 保持向后兼容的简明列表 */
const FUNCTIONAL_ROLES: RoleColor[] = FUNCTIONAL_SETS.map((set) => ({
	role: `--${set.key}`,
	light: set.light.solid,
	dark: set.dark.solid,
	note: `${set.name} · ${set.note}`,
}));

interface RampSpec {
	label: string;
	l: number;
	cRatio: number;
}

/** 色彩彩度包络：计算特定明度下的合理彩度 */
function chromaAt(l: number, seedC: number): number {
	const envelope = Math.max(0, 1 - Math.abs(l - 0.6) / 0.5);
	return clamp(seedC * envelope * 1.35, 0, 0.37);
}
/** 品牌色阶规格：经过色彩动力学微调的感知明度与饱和度包络，保障 900/950 深邃可辨且全阶可用 */
const RAMP_SPECS: RampSpec[] = [
	{ label: "50", l: 0.98, cRatio: 0.12 },
	{ label: "100", l: 0.95, cRatio: 0.25 },
	{ label: "200", l: 0.9, cRatio: 0.45 },
	{ label: "300", l: 0.82, cRatio: 0.68 },
	{ label: "400", l: 0.72, cRatio: 0.88 },
	{ label: "500", l: 0.62, cRatio: 1.0 },
	{ label: "600", l: 0.53, cRatio: 0.96 },
	{ label: "700", l: 0.44, cRatio: 0.85 },
	{ label: "800", l: 0.355, cRatio: 0.72 },
	{ label: "900", l: 0.28, cRatio: 0.6 },
	{ label: "950", l: 0.21, cRatio: 0.48 },
];

export function generatePalette(seed: SeedColor): GeneratedPalette {
	const { h, c } = seed;

	const ramp: RampStep[] = RAMP_SPECS.map((spec) => {
		const cStep = Math.min(c * spec.cRatio, 0.32);
		const s = swatch(spec.l, cStep, h);
		return { label: spec.label, oklch: s.oklch, hex: s.hex };
	});

	// 主色与强调：标准 shadcn 语义 token,每行独立值。
	// --ring 与 --primary 同值不设行,公开方言名走 aliases;
	// accent 系是主色的低占比形态(悬停与选中底及其上的文字)。
	const cLight = chromaAt(0.53, c);
	const cDark = clamp(c * 0.75, 0, 0.15); // 深域彩度受限，防 sRGB 色域裁剪
	const primaryRoles: RoleColor[] = [
		{
			role: "--primary",
			light: swatch(0.53, cLight, h),
			dark: swatch(0.72, cDark, h),
			note: "主色",
		},
		{
			role: "--primary-hover",
			light: swatch(0.47, chromaAt(0.47, c), h),
			dark: swatch(0.77, cDark * 0.92, h),
			note: "悬停加深",
		},
		{
			role: "--primary-foreground",
			light: swatch(0.99, 0, h),
			dark: swatch(0.14, 0.02, h),
			note: "主色上的文字",
		},
		{
			role: "--accent",
			light: swatch(0.965, cLight * 0.11, h),
			dark: swatch(0.22, cDark * 0.24, h),
			note: "悬停与选中底",
		},
		{
			role: "--accent-foreground",
			light: swatch(0.35, chromaAt(0.35, c) * 0.7, h),
			dark: swatch(0.9, cDark * 0.5, h),
			note: "淡染面上的文字",
		},
	];

	// 功能色：行为状态语义,色相与浓淡固定,不随种子色板更迭(明度按明暗域适配)。
	const functional = FUNCTIONAL_ROLES;

	// 中性带：与主色无同值关系的中性面；accent 系已在主色与强调组。
	const neutral: RoleColor[] = [
		{
			role: "--background",
			light: swatch(0.992, 0.004, h),
			dark: swatch(0.138, 0.012, h),
			note: "画布",
		},
		{
			role: "--foreground",
			light: swatch(0.19, 0.015, h),
			dark: swatch(0.955, 0.008, h),
			note: "墨色",
		},
		{
			role: "--card",
			light: swatch(0.985, 0.005, h),
			dark: swatch(0.17, 0.014, h),
			note: "卡片面",
		},
		{
			role: "--muted",
			light: swatch(0.955, 0.008, h),
			dark: swatch(0.21, 0.02, h),
			note: "静默面",
		},
		{
			role: "--muted-foreground",
			light: swatch(0.5, 0.02, h),
			dark: swatch(0.68, 0.015, h),
			note: "静默文字",
		},
		{ role: "--border", light: swatch(0.9, 0.01, h), dark: swatch(0.26, 0.025, h) },
		{ role: "--input", light: swatch(0.88, 0.012, h), dark: swatch(0.3, 0.03, h) },
	];

	const auditPair = (pair: string, fg: SwatchColor, bg: SwatchColor): ContrastAudit => {
		const ratio = getContrastRatio(fg.oklch, bg.oklch);
		const { rating, isAccessible } = getWcagRating(ratio);
		return { pair, ratio, rating, pass: isAccessible };
	};

	const neutralByRole: Record<string, RoleColor> = Object.fromEntries(
		neutral.map((role) => [role.role, role]),
	);
	const bgL = neutralByRole["--background"];
	const fgL = neutralByRole["--foreground"];
	const mutedFgL = neutralByRole["--muted-foreground"];
	const primaryLightColor = primaryRoles[0].light;
	const primaryDarkColor = primaryRoles[0].dark;
	const audits: ContrastAudit[] = [
		auditPair("墨色 × 画布 · 浅", fgL.light, bgL.light),
		auditPair("墨色 × 画布 · 深", fgL.dark, bgL.dark),
		auditPair("静默文字 × 画布 · 浅", mutedFgL.light, bgL.light),
		auditPair("静默文字 × 画布 · 深", mutedFgL.dark, bgL.dark),
		auditPair("主色 × 主色前景 · 浅", primaryRoles[0].light, primaryRoles[2].light),
		auditPair("主色 × 主色前景 · 深", primaryRoles[0].dark, primaryRoles[2].dark),
		auditPair("强调字 × 淡染面 · 浅", primaryRoles[4].light, primaryRoles[3].light),
		auditPair("强调字 × 淡染面 · 深", primaryRoles[4].dark, primaryRoles[3].dark),
		auditPair("主色 × 画布 · 浅", primaryLightColor, bgL.light),
		auditPair("主色 × 画布 · 深", primaryDarkColor, bgL.dark),
		auditPair("危险色 × 画布 · 浅", functional[3].light, bgL.light),
		auditPair("危险色 × 画布 · 深", functional[3].dark, bgL.dark),
		auditPair("成功色 × 画布 · 浅", functional[1].light, bgL.light),
		auditPair("成功色 × 画布 · 深", functional[1].dark, bgL.dark),
		auditPair("警示色 × 画布 · 浅", functional[2].light, bgL.light),
		auditPair("警示色 × 画布 · 深", functional[2].dark, bgL.dark),
		auditPair("信息色 × 画布 · 浅", functional[0].light, bgL.light),
		auditPair("信息色 × 画布 · 深", functional[0].dark, bgL.dark),
	];

	return {
		seed,
		ramp,
		primaryRoles,
		functional,
		functionalSets: FUNCTIONAL_SETS,
		neutral,
		audits,
	};
}
