import {
	type DecorationPreference,
	parseDecorationCookie,
} from "@shared/lib/decoration-preference";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

/** 读取 SSR 首帧的装饰偏好。 */
export const getSSRDecoration = createServerFn({ method: "GET" }).handler(
	(): DecorationPreference => parseDecorationCookie(getRequestHeader("cookie") ?? ""),
);
