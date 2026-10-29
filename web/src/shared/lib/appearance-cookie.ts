export const APPEARANCE_COOKIE_NAME = "appearance";
export const APPEARANCE_COOKIE_MAX_AGE = 31536000;

/** SSR 使用已解析的明暗值，不依赖浏览器的系统外观查询。 */
export interface AppearanceCookie {
	appearance: "light" | "dark";
	/** 仅缺少新 cookie 且旧值有效时补写，不用旧值覆盖新偏好。 */
	needsMigration: boolean;
}

/** 读取外观 cookie；缺失或非法值按浅色解析。 */
export function parseAppearanceCookie(cookie: string): AppearanceCookie {
	const current = cookie.match(/(?:^|;\s*)appearance=([^;]*)/)?.[1];
	const legacy = current === undefined ? cookie.match(/(?:^|;\s*)theme=([^;]*)/)?.[1] : undefined;
	return {
		appearance: (current ?? legacy) === "dark" ? "dark" : "light",
		needsMigration: current === undefined && (legacy === "light" || legacy === "dark"),
	};
}

/** 写入一年有效的外观 cookie，供后续 SSR 确定首帧明暗。 */
export function persistAppearanceCookie(appearance: "light" | "dark"): void {
	if (typeof cookieStore !== "undefined") {
		cookieStore
			.set({
				name: APPEARANCE_COOKIE_NAME,
				value: appearance,
				path: "/",
				sameSite: "lax",
				expires: Date.now() + APPEARANCE_COOKIE_MAX_AGE * 1000,
			})
			.catch(() => undefined);
		return;
	}
	// biome-ignore lint/suspicious/noDocumentCookie: 不支持 Cookie Store API 的浏览器仍需同步 SSR 外观
	document.cookie = `${APPEARANCE_COOKIE_NAME}=${appearance}; path=/; SameSite=Lax; Max-Age=${APPEARANCE_COOKIE_MAX_AGE}`;
}

/** 客户端路由读取外观，并将有效旧 cookie 迁移到新名称。 */
export function getClientAppearance(): "light" | "dark" {
	const { appearance, needsMigration } = parseAppearanceCookie(document.cookie);
	if (needsMigration) persistAppearanceCookie(appearance);
	return appearance;
}
