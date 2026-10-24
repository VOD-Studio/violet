import { parseThemeCookie, resolvePresetTheme, type Season } from "@shared/lib/theme-preference";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

/** 读取 SSR 首帧的预设主题；跟随季节按请求时刻解析。 */
export const getSSRPresetTheme = createServerFn({ method: "GET" }).handler(
	(): Season =>
		resolvePresetTheme(parseThemeCookie(getRequestHeader("cookie") ?? ""), new Date()),
);
