import { type Gamut, type Oklch, oklchToSrgb } from "./color.ts";

// 透明度保留 3 位小数并向上取整，保证反解出的前景通道不越出 0–1
const ALPHA_STEP = 1e-3;
// 前景通道保留 4 位小数，误差远小于 8 位量化步长
const CHANNEL_DIGITS = 4;

const formatChannel = (channel: number) => +channel.toFixed(CHANNEL_DIGITS);

/**
 * 求叠在 `background` 上视觉等同于 `target` 的半透明色：取能让前景通道落在 0–1 内的最小透明度。
 * 合成在编码后的 sRGB 中进行，与浏览器一致，因此直接以 `color(srgb …)` 输出前景，不经 OKLCH 取整。
 */
export function toAlpha(target: Oklch, background: Oklch, gamut: Gamut): string {
	const [t, b] = [oklchToSrgb(target), oklchToSrgb(background)];
	const needed = Math.max(
		...t.map((channel, index) => {
			const base = b[index] ?? 0;
			if (channel > base) return (channel - base) / (1 - base);
			if (channel < base) return (base - channel) / base;
			return 0;
		}),
	);
	const alpha = Math.min(1, Math.ceil(needed / ALPHA_STEP - 1e-9) * ALPHA_STEP);
	const foreground =
		alpha <= 0
			? b
			: t.map((channel, index) => {
					const base = b[index] ?? 0;
					return Math.min(1, Math.max(0, base + (channel - base) / alpha));
				});
	return `color(${gamut} ${foreground.map(formatChannel).join(" ")} / ${+Math.max(0, alpha).toFixed(3)})`;
}
