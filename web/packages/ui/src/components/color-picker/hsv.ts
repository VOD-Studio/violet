/** HSV 坐标：色相以度表示，饱和度与明度取 0–1。 */
export interface HsvColor {
	h: number;
	s: number;
	v: number;
}

/** 接受带或不带 # 的三位、六位 HEX，返回完整小写 HEX；非法输入返回 null。 */
export function normalizeHexColor(value: string): string | null {
	const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
	if (!match) return null;
	const digits = match[1].toLowerCase();
	return `#${digits.length === 3 ? Array.from(digits, (digit) => digit + digit).join("") : digits}`;
}

/** HEX → HSV；非法输入回落到有效蓝色坐标，不在转换中舍入精度。 */
export function hexToHsv(hex: string): HsvColor {
	const normalized = normalizeHexColor(hex);
	if (!normalized) return { h: 220, s: 0.8, v: 0.9 };
	const n = Number.parseInt(normalized.slice(1), 16);
	const r = ((n >> 16) & 255) / 255;
	const g = ((n >> 8) & 255) / 255;
	const b = (n & 255) / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const delta = max - min;
	let h = 0;
	if (delta !== 0) {
		if (max === r) h = ((g - b) / delta) % 6;
		else if (max === g) h = (b - r) / delta + 2;
		else h = (r - g) / delta + 4;
		h *= 60;
		if (h < 0) h += 360;
	}
	return { h, s: max === 0 ? 0 : delta / max, v: max };
}

/** HSV → 六位小写 HEX；色相循环，S/V 钳制到 0–1，只在最终 RGB 字节舍入。 */
export function hsvToHex(h: number, s: number, v: number): string {
	const hue = Number.isFinite(h) ? ((h % 360) + 360) % 360 : 0;
	const saturation = Number.isFinite(s) ? Math.min(1, Math.max(0, s)) : 0;
	const value = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
	const channel = (offset: number) => {
		const k = (offset + hue / 60) % 6;
		const rgb = value - value * saturation * Math.max(0, Math.min(k, 4 - k, 1));
		return Math.round(rgb * 255)
			.toString(16)
			.padStart(2, "0");
	};
	return `#${channel(5)}${channel(3)}${channel(1)}`;
}
