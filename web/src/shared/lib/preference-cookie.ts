/** 访客偏好 cookie 的有效期：一年。 */
export const PREFERENCE_COOKIE_MAX_AGE = 31536000;

/** 从 Cookie 请求头或 `document.cookie` 中取出某个 cookie 的原始值。 */
export function readCookieValue(cookie: string, name: string): string | undefined {
	return cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))?.[1];
}

/**
 * 写入一年有效的偏好 cookie，供后续 SSR 确定首帧；写入完成后才 resolve。
 *
 * @param value - 已编码、可直接放进 cookie 的值
 */
export async function writePreferenceCookie(name: string, value: string): Promise<void> {
	if (typeof cookieStore !== "undefined") {
		try {
			await cookieStore.set({
				name,
				value,
				path: "/",
				sameSite: "lax",
				expires: Date.now() + PREFERENCE_COOKIE_MAX_AGE * 1000,
			});
			return;
		} catch {
			// 写入失败时退回 document.cookie，避免路由重读到旧偏好而与画面不符
		}
	}
	// biome-ignore lint/suspicious/noDocumentCookie: 不支持或写入失败时仍需同步 SSR 首帧
	document.cookie = `${name}=${value}; path=/; SameSite=Lax; Max-Age=${PREFERENCE_COOKIE_MAX_AGE}`;
}
