import { getContrastRatio, getWcagRating, oklchToRgb } from "@shared/lib/color-math";

/**
 * 色板生成器：选定一个主色（色相 + 彩度种子），推导完整色板——
 * 品牌色（色阶与角色）、功能色、中性带与语义角色。这是「色板可插拔」
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
	/** 与现行体系的对应说明 */
	note?: string;
	/** 值完全相同的公开方言名字（如 --brand 即站内 --primary） */
	aliases?: string[];
}

export interface ContrastAudit {
	pair: string;
	ratio: number;
	rating: string;
	pass: boolean;
}

export interface GeneratedPalette {
	seed: SeedColor;
	/** 品牌色阶 ×11（浅到深） */
	ramp: RampStep[];
	/** 品牌角色层（brand/hover/wash/wash-foreground/foreground），每行独立值 */
	brandRoles: RoleColor[];
	/** 功能色（现行体系固定语义不动，此处展示同源推导的候选） */
	functional: RoleColor[];
	/** 中性带：与品牌层无同值关系的独立语义面 */
	semantic: RoleColor[];
	/** 对比度审计 */
	audits: ContrastAudit[];
}

const clamp = (x: number, min: number, max: number) => Math.min(Math.max(x, min), max);

/** 色阶彩度包络：中段饱满、两端收敛，色阶才有层次 */
function chromaAt(l: number, seedC: number): number {
	const envelope = Math.max(0, 1 - Math.abs(l - 0.6) / 0.5);
	return clamp(seedC * envelope * 1.35, 0, 0.37);
}

function swatch(l: number, c: number, h: number): SwatchColor {
	const oklch = `oklch(${Number(l.toFixed(3))} ${Number(c.toFixed(3))} ${Number(h.toFixed(1))})`;
	return { oklch, hex: oklchToRgb(l, c, h).hex };
}

/** 品牌色阶：L 从浅到深 ×11 */
const RAMP_L = [0.97, 0.93, 0.87, 0.78, 0.7, 0.62, 0.53, 0.45, 0.37, 0.28, 0.19];
const RAMP_LABELS = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];

export function generatePalette(seed: SeedColor): GeneratedPalette {
	const { h, c } = seed;

	const ramp: RampStep[] = RAMP_L.map((l, i) => {
		const s = swatch(l, chromaAt(l, c), h);
		return { label: RAMP_LABELS[i], oklch: s.oklch, hex: s.hex };
	});

	// 品牌角色层：浅域深品牌色配深字，深域浅品牌色配暗字（对齐现行品牌层形态）。
	// 只收独立值；与 --brand 同值的 --brand-ring 不设行，公开方言名走 aliases。
	const cLight = chromaAt(0.53, c);
	const cDark = clamp(c * 0.75, 0, 0.15); // 深域彩度受限，防 sRGB 色域裁剪
	const brandRoles: RoleColor[] = [
		{
			role: "--brand",
			light: swatch(0.53, cLight, h),
			dark: swatch(0.72, cDark, h),
			aliases: ["--primary", "--ring"],
			note: "品牌强调主色",
		},
		{
			role: "--brand-hover",
			light: swatch(0.47, chromaAt(0.47, c), h),
			dark: swatch(0.77, cDark * 0.92, h),
			note: "悬停加深",
		},
		{
			role: "--brand-wash",
			light: swatch(0.965, cLight * 0.11, h),
			dark: swatch(0.22, cDark * 0.24, h),
			aliases: ["--accent"],
			note: "淡染面",
		},
		{
			role: "--brand-wash-foreground",
			light: swatch(0.35, chromaAt(0.35, c) * 0.7, h),
			dark: swatch(0.9, cDark * 0.5, h),
			note: "淡染面上的文字",
		},
		{
			role: "--brand-foreground",
			light: swatch(0.99, 0, h),
			dark: swatch(0.14, 0.02, h),
			aliases: ["--primary-foreground"],
			note: "品牌面上的文字",
		},
	];

	// 功能色：语义色相固定（绿=成功、黄=警示、红=危险），明度按域适配；
	// 现行体系将其固定为不可变语义，此处展示算法全量推导的候选。
	const functionalHues = [
		{ role: "--success", h: 150 },
		{ role: "--warning", h: 85 },
		{ role: "--destructive", h: 25 },
	];
	const functional: RoleColor[] = functionalHues.map(({ role, h: fh }) => ({
		role,
		light: swatch(0.55, Math.min(c, 0.17), fh),
		dark: swatch(0.72, Math.min(c, 0.14), fh),
		note: "现行体系固定语义，不随色板更迭",
	}));

	// 中性带：只收与品牌层无同值关系的独立语义面；
	// primary/ring/accent 系是品牌层的公开方言名（见 brandRoles 的 aliases），不重复设行。
	const semantic: RoleColor[] = [
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
		{
			role: "--accent",
			light: swatch(0.955, cLight * 0.11, h),
			dark: swatch(0.25, cDark * 0.3, h),
			note: "悬停与选中底",
		},
		{ role: "--border", light: swatch(0.9, 0.01, h), dark: swatch(0.26, 0.025, h) },
		{ role: "--input", light: swatch(0.88, 0.012, h), dark: swatch(0.3, 0.03, h) },
	];

	const auditPair = (pair: string, fg: SwatchColor, bg: SwatchColor): ContrastAudit => {
		const ratio = getContrastRatio(fg.oklch, bg.oklch);
		const { rating, isAccessible } = getWcagRating(ratio);
		return { pair, ratio, rating, pass: isAccessible };
	};

	const semanticByRole: Record<string, RoleColor> = Object.fromEntries(
		semantic.map((role) => [role.role, role]),
	);
	const bgL = semanticByRole["--background"];
	const fgL = semanticByRole["--foreground"];
	const mutedFgL = semanticByRole["--muted-foreground"];
	const brandLightColor = brandRoles[0].light;
	const brandDarkColor = brandRoles[0].dark;
	const audits: ContrastAudit[] = [
		auditPair("墨色 × 画布 · 浅", fgL.light, bgL.light),
		auditPair("墨色 × 画布 · 深", fgL.dark, bgL.dark),
		auditPair("静默文字 × 画布 · 浅", mutedFgL.light, bgL.light),
		auditPair("静默文字 × 画布 · 深", mutedFgL.dark, bgL.dark),
		auditPair("品牌 × 品牌前景 · 浅", brandRoles[0].light, brandRoles[4].light),
		auditPair("品牌 × 品牌前景 · 深", brandRoles[0].dark, brandRoles[4].dark),
		auditPair("品牌字 × 淡染面 · 浅", brandRoles[3].light, brandRoles[2].light),
		auditPair("品牌字 × 淡染面 · 深", brandRoles[3].dark, brandRoles[2].dark),
		auditPair("品牌 × 画布 · 浅", brandLightColor, bgL.light),
		auditPair("品牌 × 画布 · 深", brandDarkColor, bgL.dark),
	];

	return { seed, ramp, brandRoles, functional, semantic, audits };
}
