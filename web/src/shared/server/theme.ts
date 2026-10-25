import {
	parseCustomThemeCookie,
	parseThemeCookie,
	resolvePresetTheme,
	type ThemeState,
} from "@shared/lib/theme-preference";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

/** 读取 SSR 首帧的主题；跟随季节按请求时刻解析，非法的自定义主题不生效。 */
export const getSSRThemeState = createServerFn({ method: "GET" }).handler((): ThemeState => {
	const cookie = getRequestHeader("cookie") ?? "";
	const preference = parseThemeCookie(cookie);
	return {
		preference,
		preset: resolvePresetTheme(preference, new Date()),
		custom: parseCustomThemeCookie(cookie),
	};
});
