import type { Palette } from "../types.ts";

/** 缺少角色时明确失败，不以默认色掩盖配置遗漏。 */
export function paintColor(palette: Palette, role: string): string {
	const color = palette[role];
	if (color === undefined) throw new Error(`未配置绘制颜色：${role}`);
	return color;
}
