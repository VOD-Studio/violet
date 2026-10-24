/** 四季预设主题的标识，按春夏秋冬排列。 */
export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;

/** 预设主题，与季节一一对应。 */
export type Season = (typeof SEASONS)[number];

/** 访客的主题偏好：跟随季节或指定某一季。 */
export type ThemePreference = "follow" | Season;

/** 路由上下文中的主题：访客的选择与实际渲染的预设。 */
export interface ThemeState {
	preference: ThemePreference;
	preset: Season;
}

/** 主题偏好 cookie 名；旧的 `theme` cookie 保存外观，不能复用。 */
export const THEME_COOKIE_NAME = "theme-preference";
/** 有效期一年，与外观偏好一致。 */
const THEME_COOKIE_MAX_AGE = 31536000;
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

/** 客户端路由读取主题：预设沿用首帧的 data-theme，水合后不随客户端时钟跨季翻转。 */
export function getClientThemeState(): ThemeState {
	const preference = parseThemeCookie(document.cookie);
	const rendered = document.documentElement.dataset.theme;
	return {
		preference,
		preset: isSeason(rendered) ? rendered : resolvePresetTheme(preference, new Date()),
	};
}

/** 写入一年有效的主题偏好 cookie，供后续 SSR 确定首帧主题；写入完成后才 resolve。 */
export async function persistThemePreference(preference: ThemePreference): Promise<void> {
	const value = serializeThemePreference(preference);
	if (typeof cookieStore !== "undefined") {
		try {
			await cookieStore.set({
				name: THEME_COOKIE_NAME,
				value,
				path: "/",
				sameSite: "lax",
				expires: Date.now() + THEME_COOKIE_MAX_AGE * 1000,
			});
			return;
		} catch {
			// 写入失败时退回 document.cookie，避免路由重读到旧偏好而与画面不符
		}
	}
	// biome-ignore lint/suspicious/noDocumentCookie: 不支持或写入失败时仍需同步 SSR 主题
	document.cookie = `${THEME_COOKIE_NAME}=${value}; path=/; SameSite=Lax; Max-Age=${THEME_COOKIE_MAX_AGE}`;
}
