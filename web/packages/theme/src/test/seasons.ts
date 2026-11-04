import type { Theme } from "../index.ts";

/**
 * UED 设计稿「基础」页的四季输入：种子色、色相与两个共用旋钮（docs/design/ued/project/Controls.dc.html）。
 * 设计稿的色相取整，种子色是站点预设使用的种子，两者最多差约 5°。
 */
export const SEASONS = {
	春: { seed: "#f47983", hue: 16.6 },
	夏: { seed: "#2f9e7a", hue: 162 },
	秋: { seed: "#d9a21b", hue: 82.95 },
	冬: { seed: "#7d8ea3", hue: 252 },
} as const;
export type Season = keyof typeof SEASONS;
export const SEASON_NAMES = Object.keys(SEASONS) as Season[];

export const DESIGN_NEUTRAL_CHROMA = 0.025;
/** 浅色强调字的色度；深色取它的 1.0585 倍，由包内规则给出 */
export const DESIGN_ACCENT_CHROMA = 0.0974;

export const seasonTheme = (season: Season): Theme => ({
	version: 1,
	seed: SEASONS[season].seed,
	knobs: { neutralChroma: DESIGN_NEUTRAL_CHROMA, accentChroma: DESIGN_ACCENT_CHROMA },
});
