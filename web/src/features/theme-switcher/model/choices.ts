import { SEASONS, type ThemePreference } from "@shared/lib/theme-preference";
import { THEME_PRESETS } from "@shared/lib/theme-presets";

/** 切换入口的选项顺序：跟随季节在前，其后按春夏秋冬。 */
export const THEME_CHOICES: readonly ThemePreference[] = ["follow", ...SEASONS];

/** 选项标题，如「跟随季节」「春 · 花朝」。 */
export function themeChoiceTitle(preference: ThemePreference): string {
	if (preference === "follow") return "跟随季节";
	const { label, name } = THEME_PRESETS[preference];
	return `${label} · ${name}`;
}
