/** 颜色工具:十六进制色值的解析/明暗调整/线性插值。 */
import { clamp, lerp } from "./math";

/**
 * 十六进制色转 RGB 三元组。
 *
 * @param hex - #rgb 或 #rrggbb
 */
export function hexToRgb(hex: string): [number, number, number] {
	const n = Number.parseInt(hex.replace("#", ""), 16);
	if (hex.length <= 4) {
		const r = (n >> 8) & 0xf;
		const g = (n >> 4) & 0xf;
		const b = n & 0xf;
		return [(r << 4) | r, (g << 4) | g, (b << 4) | b];
	}
	return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/**
 * RGB 转十六进制色,分量钳制到 [0, 255]。
 *
 * @param c - RGB 三元组
 */
export function rgbToHex(c: readonly [number, number, number]): string {
	return `#${c.map((x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * 调亮/调暗颜色。
 *
 * @param hex - 原色
 * @param amt - 幅度 [-1, 1]:正数向白混合,负数向黑衰减
 */
export function shade(hex: string, amt: number): string {
	const rgb = hexToRgb(hex);
	return rgbToHex(
		rgb.map((c) => clamp(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt), 0, 255)) as [
			number,
			number,
			number,
		],
	);
}

/**
 * 两色线性插值(经 RGB 通道)。
 *
 * @param a - 起点色
 * @param b - 终点色
 * @param t - 插值因子 [0, 1]
 */
export function lerpColor(a: string, b: string, t: number): string {
	const ra = hexToRgb(a);
	const rb = hexToRgb(b);
	return rgbToHex([lerp(ra[0], rb[0], t), lerp(ra[1], rb[1], t), lerp(ra[2], rb[2], t)]);
}
