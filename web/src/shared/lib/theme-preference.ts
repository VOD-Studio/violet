/** 四季预设主题的标识，按春夏秋冬排列。 */
export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;

/** 预设主题，与季节一一对应。 */
export type Season = (typeof SEASONS)[number];

/** 访客的主题偏好：跟随季节或指定某一季。 */
export type ThemePreference = "follow" | Season;

/** 主题偏好 cookie 名；旧的 `theme` cookie 保存外观，不能复用。 */
export const THEME_COOKIE_NAME = "theme-preference";
/** Cookie 数据版本；结构不兼容地变化时递增，旧值回落为跟随季节。 */
const THEME_COOKIE_VERSION = 1;

const isSeason = (value: unknown): value is Season =>
	(SEASONS as readonly unknown[]).includes(value);

const isPreference = (value: unknown): value is ThemePreference =>
	value === "follow" || isSeason(value);

/** 读取主题偏好 cookie；缺失、版本不符或任何非法值都回落为跟随季节。 */
export function parseThemeCookie(cookie: string): ThemePreference {
	const raw = cookie.match(new RegExp(`(?:^|;\\s*)${THEME_COOKIE_NAME}=([^;]*)`))?.[1];
	if (raw === undefined) return "follow";
	try {
		const data: unknown = JSON.parse(decodeURIComponent(raw));
		if (
			typeof data === "object" &&
			data !== null &&
			"v" in data &&
			data.v === THEME_COOKIE_VERSION &&
			"theme" in data &&
			isPreference(data.theme)
		)
			return data.theme;
	} catch {
		// 编码或 JSON 损坏同样回落
	}
	return "follow";
}

/** 主题偏好 cookie 的值（已 URL 编码的版本化 JSON）。 */
export function serializeThemePreference(preference: ThemePreference): string {
	return encodeURIComponent(JSON.stringify({ v: THEME_COOKIE_VERSION, theme: preference }));
}

/** 跟随季节按站点时区判定月份，SSR 与浏览器得出同一季节。 */
const SITE_TIME_ZONE = "Asia/Shanghai";

const monthFormat = new Intl.DateTimeFormat("en-US", {
	timeZone: SITE_TIME_ZONE,
	month: "numeric",
});

/**
 * 把主题偏好解析成要渲染的预设主题。
 *
 * @param date - 跟随季节时判定月份的时刻：3–5 月春、6–8 月夏、9–11 月秋、12–2 月冬
 */
export function resolvePresetTheme(preference: ThemePreference, date: Date): Season {
	if (preference !== "follow") return preference;
	const month = Number(monthFormat.format(date));
	if (month >= 3 && month <= 5) return "spring";
	if (month >= 6 && month <= 8) return "summer";
	if (month >= 9 && month <= 11) return "autumn";
	return "winter";
}
