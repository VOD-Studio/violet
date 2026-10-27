import { readCookieValue, writePreferenceCookie } from "./preference-cookie";
import { SEASONS, type Season, type ThemeState } from "./theme-preference";

/** 访客的装饰偏好：跟随主题、关闭或指定某一季。 */
export type DecorationPreference = "theme" | "none" | Season;

/** 装饰偏好的全部取值，按跟随主题、关闭、春夏秋冬排列。 */
export const DECORATION_PREFERENCES = [
	"theme",
	"none",
	...SEASONS,
] as const satisfies readonly DecorationPreference[];

/** 装饰偏好 cookie 名，与主题偏好分开保存。 */
export const DECORATION_COOKIE_NAME = "decoration-preference";

const isDecorationPreference = (value: unknown): value is DecorationPreference =>
	(DECORATION_PREFERENCES as readonly unknown[]).includes(value);

/** 读取装饰偏好 cookie；缺失或非法值回落为跟随主题。 */
export function parseDecorationCookie(cookie: string): DecorationPreference {
	const value = readCookieValue(cookie, DECORATION_COOKIE_NAME);
	return isDecorationPreference(value) ? value : "theme";
}

/**
 * 实际投放的季节装饰；null 表示不显示。
 *
 * 跟随主题时取预设主题的季节；自定义主题没有对应季节，跟随主题时不显示。
 */
export function resolveDecoration(
	decoration: DecorationPreference,
	theme: Pick<ThemeState, "preset" | "custom">,
): Season | null {
	if (decoration === "none") return null;
	if (decoration === "theme") return theme.custom ? null : theme.preset;
	return decoration;
}

/** 客户端路由读取装饰偏好。 */
export const getClientDecoration = (): DecorationPreference =>
	parseDecorationCookie(document.cookie);

/** 写入装饰偏好 cookie，供后续 SSR 确定首帧装饰；写入完成后才 resolve。 */
export const persistDecorationPreference = (decoration: DecorationPreference): Promise<void> =>
	writePreferenceCookie(DECORATION_COOKIE_NAME, decoration);
