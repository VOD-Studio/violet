import { APCAcontrast, sRGBtoY } from "apca-w3";
import Color from "colorjs.io";

const parsed = new Map<string, Color>();

/** 用 CSS Color 4 参考实现解析生成结果，不复用包内的换算；结果只读，按字符串缓存。 */
export const parse = (css: string): Color => {
	const cached = parsed.get(css);
	if (cached) return cached;
	const color = new Color(css);
	// 不透明色输出为 oklch()，透明度色阶在合成空间 sRGB 中输出为 color(srgb …)
	if (color.space.id !== "oklch" && color.space.id !== "srgb")
		throw new Error(`Expected oklch() or color(srgb), got ${css}`);
	parsed.set(css, color);
	return color;
};

// 浮点值是 CSS 的精确取值，8 位量化值是多数屏幕实际显示的颜色，两者都须达标
export const PRECISIONS = ["float", "quantized"] as const;
type Precision = (typeof PRECISIONS)[number];

interface Measured {
	/** 0–255 的 sRGB 通道 */
	rgb: Record<Precision, number[]>;
	/** WCAG 2 相对亮度 */
	luminance: Record<Precision, number>;
	/** APCA 使用的屏幕亮度 Y */
	apcaY: Record<Precision, number>;
}

const wcagLuminance = (rgb: number[]) => {
	const [r = 0, g = 0, b = 0] = rgb.map((channel) => {
		const value = channel / 255;
		return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const cache = new Map<string, Measured>();

/** 解析并缓存一个颜色的 sRGB 通道与两种亮度，遍历测试中同一颜色会被反复比较。 */
export const measure = (css: string): Measured => {
	const cached = cache.get(css);
	if (cached) return cached;
	const float = parse(css)
		.to("srgb")
		.coords.map((channel) => Math.min(255, Math.max(0, (channel ?? 0) * 255)));
	const quantized = float.map(Math.round);
	const measured = {
		rgb: { float, quantized },
		luminance: { float: wcagLuminance(float), quantized: wcagLuminance(quantized) },
		apcaY: { float: sRGBtoY(float), quantized: sRGBtoY(quantized) },
	};
	cache.set(css, measured);
	return measured;
};

/** WCAG 2.2 对比度比值。 */
export const wcag = (a: string, b: string, precision: Precision = "float") => {
	const [la, lb] = [measure(a).luminance[precision], measure(b).luminance[precision]];
	return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/** APCA Lc 绝对值，使用官方 apca-w3。极性有意义：先文字后背景。 */
export const apca = (text: string, background: string, precision: Precision = "float") =>
	Math.abs(
		Number(APCAcontrast(measure(text).apcaY[precision], measure(background).apcaY[precision])),
	);

export const toHex = (color: Color) =>
	color.to("srgb").toString({ format: "hex", collapse: false });

/** 以 CSS Color 4 的色域映射把 OKLCH 坐标转成 `#rrggbb` 种子色。 */
export const seedHex = (l: number, c: number, h: number) =>
	toHex(new Color("oklch", [l, c, h]).toGamut({ space: "srgb", method: "css" }));

/** OKLab 色差；CSS Color 4 以 0.02 作为可察觉阈值（JND）。 */
export const deltaE = (a: string | Color, b: string | Color) =>
	(typeof a === "string" ? parse(a) : a).deltaE(typeof b === "string" ? parse(b) : b, "OK");

/** 半透明色叠在不透明背景上的结果，与浏览器一样在编码后的 sRGB 中合成。 */
export const composite = (foreground: string, background: string) => {
	const top = parse(foreground).to("srgb");
	const bottom = parse(background).to("srgb");
	const alpha = top.alpha ?? 1;
	return new Color(
		"srgb",
		top.coords.map(
			(channel, index) => alpha * (channel ?? 0) + (1 - alpha) * (bottom.coords[index] ?? 0),
		) as [number, number, number],
	);
};
