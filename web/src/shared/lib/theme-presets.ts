import type { Knobs } from "@violetjs/theme";

import type { Season } from "./theme-preference";

/** 预设主题的种子色与旋钮；取值为 #645 样稿定稿，改动需重新出样稿。 */
export const THEME_PRESETS: Record<Season, { seed: string; knobs: Knobs }> = {
	spring: { seed: "#f47983", knobs: { neutralChroma: 0.02 } }, // 花朝
	summer: { seed: "#2f9e7a", knobs: { neutralChroma: 0.012 } }, // 荷风
	autumn: { seed: "#d9a21b", knobs: { neutralChroma: 0.025 } }, // 桂月
	winter: { seed: "#7d8ea3", knobs: { neutralChroma: 0.008 } }, // 初雪
};
