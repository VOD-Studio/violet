/** 生成结果须落入的色域；目前只支持 sRGB。 */
export type Gamut = "srgb";

/** OKLCH 坐标；h 为角度，c 为 0 时 h 无意义并固定为 0。 */
export interface Oklch {
	l: number;
	c: number;
	h: number;
}

type Vector3 = readonly [number, number, number];
type Matrix3 = readonly [Vector3, Vector3, Vector3];

// 矩阵取自 CSS Color 4，浏览器按同一组系数把 oklch() 换算到显示色域
const LINEAR_SRGB_TO_XYZ: Matrix3 = [
	[0.41239079926595934, 0.357584339383878, 0.1804807884018343],
	[0.21263900587151027, 0.715168678767756, 0.07219231536073371],
	[0.01933081871559182, 0.11919477979462598, 0.9505321522496607],
];
const XYZ_TO_LINEAR_SRGB: Matrix3 = [
	[3.2409699419045226, -1.537383177570094, -0.4986107602930034],
	[-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
	[0.05563007969699366, -0.20397695888897652, 1.0569715142428786],
];
const XYZ_TO_LMS: Matrix3 = [
	[0.819022437996703, 0.3619062600528904, -0.1288737815209879],
	[0.0329836539323885, 0.9292868615863434, 0.0361446663506424],
	[0.0481771893596242, 0.2642395317527308, 0.6335478284694309],
];
const LMS_TO_XYZ: Matrix3 = [
	[1.2268798758459243, -0.5578149944602171, 0.2813910456659647],
	[-0.0405757452148008, 1.112286803280317, -0.0717110580655164],
	[-0.0763729366746601, -0.4214933324022432, 1.5869240198367816],
];
const LMS_TO_OKLAB: Matrix3 = [
	[0.210454268309314, 0.7936177747023054, -0.0040720430116193],
	[1.9779985324311684, -2.42859224204858, 0.450593709617411],
	[0.0259040424655478, 0.7827717124575296, -0.8086757549230774],
];
const OKLAB_TO_LMS: Matrix3 = [
	[1, 0.3963377773761749, 0.2158037573099136],
	[1, -0.1055613458156586, -0.0638541728258133],
	[1, -0.0894841775298119, -1.2914855480194092],
];

const multiply = (m: Matrix3, v: Vector3): Vector3 => [
	m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
	m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
	m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
];
const compose = (outer: Matrix3, inner: Matrix3): Matrix3 => {
	const column = (index: 0 | 1 | 2) =>
		multiply(outer, [inner[0][index], inner[1][index], inner[2][index]]);
	const [c0, c1, c2] = [column(0), column(1), column(2)];
	return [
		[c0[0], c1[0], c2[0]],
		[c0[1], c1[1], c2[1]],
		[c0[2], c1[2], c2[2]],
	];
};

const LINEAR_SRGB_TO_LMS = compose(XYZ_TO_LMS, LINEAR_SRGB_TO_XYZ);
const LMS_TO_LINEAR_SRGB = compose(XYZ_TO_LINEAR_SRGB, LMS_TO_XYZ);
const LUMINANCE = LINEAR_SRGB_TO_XYZ[1];
const DEGREES = Math.PI / 180;
// 浮点换算在色域边界上会产生 1e-15 量级的越界，阈值远小于 8 位量化步长
const GAMUT_EPSILON = 1e-7;
// 输出精度：亮度与色度保留 4 位、色相 2 位，变化远小于 8 位量化步长
const LIGHTNESS_STEP = 1e-4;
const CHROMA_STEP = 1e-4;
const HUE_STEP = 1e-2;
// 二分查找色度的上界，高于 sRGB 与 Display P3 任何颜色的 OKLCH 色度
const CHROMA_SEARCH_LIMIT = 0.5;

const decode = (channel: number) =>
	channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

export function oklchToLinearRgb({ l, c, h }: Oklch): Vector3 {
	const lms = multiply(OKLAB_TO_LMS, [l, c * Math.cos(h * DEGREES), c * Math.sin(h * DEGREES)]);
	return multiply(LMS_TO_LINEAR_SRGB, [lms[0] ** 3, lms[1] ** 3, lms[2] ** 3]);
}

function linearRgbToOklch(rgb: Vector3): Oklch {
	const lms = multiply(LINEAR_SRGB_TO_LMS, rgb);
	const [l, a, b] = multiply(LMS_TO_OKLAB, [
		Math.cbrt(lms[0]),
		Math.cbrt(lms[1]),
		Math.cbrt(lms[2]),
	]);
	const h = (Math.atan2(b, a) / DEGREES + 360) % 360;
	return { l, c: Math.hypot(a, b), h };
}

/** 解析 `#rrggbb`；调用方须先确认格式合法。 */
export function hexToOklch(hex: string): Oklch {
	const value = Number.parseInt(hex.slice(1), 16);
	return linearRgbToOklch([
		decode(((value >> 16) & 255) / 255),
		decode(((value >> 8) & 255) / 255),
		decode((value & 255) / 255),
	]);
}

export function relativeLuminance(color: Oklch): number {
	const rgb = oklchToLinearRgb(color);
	return LUMINANCE[0] * rgb[0] + LUMINANCE[1] * rgb[1] + LUMINANCE[2] * rgb[2];
}

function inGamut(color: Oklch, _gamut: Gamut): boolean {
	return oklchToLinearRgb(color).every(
		(channel) => channel >= -GAMUT_EPSILON && channel <= 1 + GAMUT_EPSILON,
	);
}

/**
 * 在亮度与色相不变的前提下取色域能容纳的最大色度，即 CSS Color 4 色域映射的
 * 「只降色度」，但不做末尾的就近裁切，因此色相与亮度严格保持。
 */
function maxChroma(l: number, h: number, gamut: Gamut): number {
	if (l <= 0 || l >= 1) return 0;
	let inside = 0;
	let outside = CHROMA_SEARCH_LIMIT;
	while (outside - inside > CHROMA_STEP / 4) {
		const middle = (inside + outside) / 2;
		if (inGamut({ l, c: middle, h }, gamut)) inside = middle;
		else outside = middle;
	}
	return inside;
}

const roundTo = (value: number, step: number) => Math.round(value / step) * step;
// 1e-9 抵消浮点误差，避免 0.3 / 0.0001 = 2999.9999… 被向下取整成少一档
const floorTo = (value: number, step: number) => Math.floor(value / step + 1e-9) * step;

/**
 * 把目标色收进色域并按输出精度取整，保证取整后的坐标仍在色域内。
 *
 * @returns 可直接序列化的坐标，c 不超过请求值
 */
export function fitGamut(l: number, c: number, h: number, gamut: Gamut): Oklch {
	const lightness = Math.min(1, Math.max(0, roundTo(l, LIGHTNESS_STEP)));
	const hue = roundTo(h, HUE_STEP) % 360;
	const requested = floorTo(c, CHROMA_STEP);
	// 多数档位的色度远在色域内，先直接检查请求值，省去二分查找
	let chroma =
		requested <= 0 || inGamut({ l: lightness, c: requested, h: hue }, gamut)
			? requested
			: floorTo(Math.min(c, maxChroma(lightness, hue, gamut)), CHROMA_STEP);
	while (chroma > 0 && !inGamut({ l: lightness, c: chroma, h: hue }, gamut))
		chroma = floorTo(chroma - CHROMA_STEP, CHROMA_STEP);
	if (chroma <= 0) return { l: lightness, c: 0, h: 0 };
	return { l: lightness, c: chroma, h: hue };
}

export function formatOklch({ l, c, h }: Oklch): string {
	return `oklch(${+l.toFixed(4)} ${+c.toFixed(4)} ${+h.toFixed(2)})`;
}
