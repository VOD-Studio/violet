import {
	type DecorationLayers,
	type DecorationPreference,
	parseDecorationCookie,
	parseDecorationLayersCookie,
} from "@shared/lib/decoration-preference";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

/** 读取 SSR 首帧的装饰偏好。 */
export const getSSRDecoration = createServerFn({ method: "GET" }).handler(
	(): DecorationPreference => parseDecorationCookie(getRequestHeader("cookie") ?? ""),
);

/** 读取 SSR 首帧启用的装饰层。 */
export const getSSRDecorationLayers = createServerFn({ method: "GET" }).handler(
	(): DecorationLayers => parseDecorationLayersCookie(getRequestHeader("cookie") ?? ""),
);
