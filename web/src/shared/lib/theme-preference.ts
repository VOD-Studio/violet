import { type NormalizedTheme, normalizeTheme } from "@violetjs/theme";

import { readCookieValue, writePreferenceCookie } from "./preference-cookie";

/** 四季预设主题的标识，按春夏秋冬排列。 */
export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;

/** 预设主题，与季节一一对应。 */
export type Season = (typeof SEASONS)[number];

/** 访客的主题偏好：跟随季节或指定某一季。 */
export type ThemePreference = "follow" | Season;

/** 路由上下文中的主题：访客的选择、季节与自定义主题。 */
export interface ThemeState {
	preference: ThemePreference;
	/** 偏好解析出的季节；自定义主题生效时仍供寄语等季节内容使用 */
	preset: Season;
	/** 规范化后的自定义主题；存在时优先于预设，选回任何预设即清除 */
	custom: NormalizedTheme | null;
}

/** `<html data-theme>` 的值：自定义主题为 `custom`，否则为预设季节。 */
export const renderedTheme = ({ preset, custom }: ThemeState): Season | "custom" =>
	custom ? "custom" : preset;

/** 主题偏好 cookie 名；旧的 `theme` cookie 保存外观，不能复用。 */
export const THEME_COOKIE_NAME = "theme-preference";
/** Cookie 数据版本；结构不兼容地变化时递增，旧值回落为跟随季节。 */
const THEME_COOKIE_VERSION = 1;

const isSeason = (value: unknown): value is Season =>
	(SEASONS as readonly unknown[]).includes(value);

const isPreference = (value: unknown): value is ThemePreference =>
	value === "follow" || isSeason(value);

/** 当前版本的 cookie 数据；缺失、编码或 JSON 损坏、版本不符时为 null。 */
function readThemeCookie(cookie: string): Record<string, unknown> | null {
	const raw = readCookieValue(cookie, THEME_COOKIE_NAME);
	if (raw === undefined) return null;
	try {
		const data: unknown = JSON.parse(decodeURIComponent(raw));
		if (
			typeof data === "object" &&
			data !== null &&
			!Array.isArray(data) &&
			"v" in data &&
			data.v === THEME_COOKIE_VERSION
		)
			return data as Record<string, unknown>;
	} catch {
		// 编码或 JSON 损坏同样视为没有偏好
	}
	return null;
}

/** 读取主题偏好 cookie；缺失、版本不符或任何非法值都回落为跟随季节。 */
export function parseThemeCookie(cookie: string): ThemePreference {
	const theme = readThemeCookie(cookie)?.theme;
	return isPreference(theme) ? theme : "follow";
}

/** 规范化失败的标记：normalizeTheme 回落时沿用这里的空种子色。 */
const INVALID_THEME: NormalizedTheme = { ...normalizeTheme(undefined), seed: "" };

/**
 * 读取自定义主题；没有或非法时为 null，此时按预设偏好渲染。
 *
 * @returns 只含规范化种子色与已知旋钮的新对象，可安全地拼进 CSS
 */
export function parseCustomThemeCookie(cookie: string): NormalizedTheme | null {
	const theme = normalizeTheme(readThemeCookie(cookie)?.custom, INVALID_THEME);
	return theme.seed === "" ? null : theme;
}

/** 主题偏好 cookie 的值（已 URL 编码的版本化 JSON）。 */
export function serializeThemePreference(
	preference: ThemePreference,
	custom: NormalizedTheme | null = null,
): string {
	return encodeURIComponent(
		JSON.stringify({
			v: THEME_COOKIE_VERSION,
			theme: preference,
			...(custom ? { custom } : {}),
		}),
	);
}

/** 跟随季节按站点时区判定月份，SSR 与浏览器得出同一季节。 */
const SITE_TIME_ZONE = "Asia/Shanghai";

const monthFormat = new Intl.DateTimeFormat("en-US", {
	timeZone: SITE_TIME_ZONE,
	month: "numeric",
});

/** 各季起始月份，每季三个月；跟随季节的判定与月份文案都由此派生。 */
const SEASON_START_MONTH: Record<Season, number> = { spring: 3, summer: 6, autumn: 9, winter: 12 };

const isMonthIn = (season: Season, month: number) =>
	(month - SEASON_START_MONTH[season] + 12) % 12 < 3;

/**
 * 把主题偏好解析成要渲染的预设主题。
 *
 * @param date - 跟随季节时按站点时区取月份的时刻
 */
export function resolvePresetTheme(preference: ThemePreference, date: Date): Season {
	if (preference !== "follow") return preference;
	const month = Number(monthFormat.format(date));
	return SEASONS.find((season) => isMonthIn(season, month)) ?? "winter";
}

/** 季节覆盖的月份，如「3–5 月」。 */
export function seasonMonths(season: Season): string {
	const start = SEASON_START_MONTH[season];
	return `${start}–${((start + 1) % 12) + 1} 月`;
}

/** 客户端路由读取主题：季节沿用首帧的 data-season，水合后不随客户端时钟跨季翻转。 */
export function getClientThemeState(): ThemeState {
	const preference = parseThemeCookie(document.cookie);
	const { season, theme } = document.documentElement.dataset;
	const rendered = season ?? theme;
	return {
		preference,
		preset: isSeason(rendered) ? rendered : resolvePresetTheme(preference, new Date()),
		custom: parseCustomThemeCookie(document.cookie),
	};
}

/**
 * 写入主题偏好 cookie，供后续 SSR 确定首帧主题；写入完成后才 resolve。
 *
 * @param custom - 自定义主题；省略即清除，回到预设偏好
 */
export function persistThemePreference(
	preference: ThemePreference,
	custom: NormalizedTheme | null = null,
): Promise<void> {
	return writePreferenceCookie(THEME_COOKIE_NAME, serializeThemePreference(preference, custom));
}
