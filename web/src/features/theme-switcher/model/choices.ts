import type { DecorationLayer, DecorationPreference } from "@shared/lib/decoration-preference";
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

export const DECORATION_LAYER_LABELS: Record<DecorationLayer, string> = {
	illustration: "插画",
	particles: "飘落",
	ornaments: "挂件",
};

/** 装饰入口共用的偏好标题。 */
export function decorationChoiceTitle(preference: DecorationPreference): string {
	if (preference === "theme") return "跟随主题";
	if (preference === "none") return "无";
	return themeChoiceTitle(preference);
}
