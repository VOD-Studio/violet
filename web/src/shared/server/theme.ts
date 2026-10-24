import {
	parseThemeCookie,
	resolvePresetTheme,
	type ThemeState,
} from "@shared/lib/theme-preference";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

/** 读取 SSR 首帧的主题；跟随季节按请求时刻解析。 */
export const getSSRThemeState = createServerFn({ method: "GET" }).handler((): ThemeState => {
	const preference = parseThemeCookie(getRequestHeader("cookie") ?? "");
	return { preference, preset: resolvePresetTheme(preference, new Date()) };
});
