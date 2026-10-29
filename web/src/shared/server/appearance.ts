import {
	APPEARANCE_COOKIE_MAX_AGE,
	APPEARANCE_COOKIE_NAME,
	parseAppearanceCookie,
} from "@shared/lib/appearance-cookie";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setCookie } from "@tanstack/react-start/server";

/** 读取 SSR 首帧外观；有效旧 cookie 通过响应头迁移，禁用 JS 时也能保留偏好。 */
export const getSSRAppearance = createServerFn({ method: "GET" }).handler((): "light" | "dark" => {
	const { appearance, needsMigration } = parseAppearanceCookie(getRequestHeader("cookie") ?? "");
	if (needsMigration) {
		setCookie(APPEARANCE_COOKIE_NAME, appearance, {
			path: "/",
			sameSite: "lax",
			maxAge: APPEARANCE_COOKIE_MAX_AGE,
		});
	}
	return appearance;
});
