import type { Palette } from "@violetjs/inkline";

export type DemoTheme = "light" | "dark";

const DARK_PAPER = "#1f1d27";
const DARK_INK = "#ece8f6";

/** 深色主题下纸与墨换成深底浅线，彩色角色保持原色；几何不变，只换配色。 */
export function themedPalette(palette: Palette, theme: DemoTheme): Palette {
	return theme === "dark" ? { ...palette, paper: DARK_PAPER, ink: DARK_INK } : palette;
}
