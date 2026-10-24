import type { Knobs } from "@violetjs/theme";

import type { Season } from "./theme-preference";

/** 预设主题的展示信息与生成参数。 */
export interface ThemePreset {
	/** 季节字，如「春」 */
	label: string;
	/** 主题名，如「花朝」 */
	name: string;
	seed: string;
	knobs: Knobs;
}

/** 四季预设；种子色与旋钮为 #645 样稿定稿，改动需重新出样稿。 */
export const THEME_PRESETS: Record<Season, ThemePreset> = {
	spring: {
		label: "春",
		name: "花朝",
		seed: "#f47983",
		knobs: { neutralChroma: 0.02 },
	},
	summer: {
		label: "夏",
		name: "荷风",
		seed: "#2f9e7a",
		knobs: { neutralChroma: 0.012 },
	},
	autumn: {
		label: "秋",
		name: "桂月",
		seed: "#d9a21b",
		knobs: { neutralChroma: 0.025 },
	},
	winter: {
		label: "冬",
		name: "初雪",
		seed: "#7d8ea3",
		knobs: { neutralChroma: 0.008 },
	},
};
