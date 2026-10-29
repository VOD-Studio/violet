import { readCookieValue, writePreferenceCookie } from "./preference-cookie";
import { SEASONS, type Season, type ThemeState } from "./theme-preference";

/** 访客的装饰偏好：跟随主题、关闭或指定某一季。 */
export type DecorationPreference = "theme" | "none" | Season;

/** 装饰偏好的全部取值，按跟随主题、关闭、春夏秋冬排列。 */
export const DECORATION_PREFERENCES = [
	"theme",
	"none",
	...SEASONS,
] as const satisfies readonly DecorationPreference[];

/** 装饰偏好 cookie 名，与主题偏好分开保存。 */
export const DECORATION_COOKIE_NAME = "decoration-preference";

/** 可独立启停的装饰层；插画同时控制角落大图与首页点缀。 */
export const DECORATION_LAYERS = ["illustration", "particles", "ornaments"] as const;

export type DecorationLayer = (typeof DECORATION_LAYERS)[number];
export type DecorationLayers = Readonly<Record<DecorationLayer, boolean>>;

export const DEFAULT_DECORATION_LAYERS: DecorationLayers = {
	illustration: true,
	particles: true,
	ornaments: true,
};

export const DECORATION_LAYERS_COOKIE_NAME = "decoration-layers";

/** 缺失或含未知层的 cookie 回落为全部启用，none 表示全部关闭。 */
export function parseDecorationLayersCookie(cookie: string): DecorationLayers {
	const value = readCookieValue(cookie, DECORATION_LAYERS_COOKIE_NAME);
	if (value === undefined) return DEFAULT_DECORATION_LAYERS;
	if (value === "none") return { illustration: false, particles: false, ornaments: false };
	const enabled = value.split(",");
	if (!enabled.every((layer) => (DECORATION_LAYERS as readonly string[]).includes(layer)))
		return DEFAULT_DECORATION_LAYERS;
	return {
		illustration: enabled.includes("illustration"),
		particles: enabled.includes("particles"),
		ornaments: enabled.includes("ornaments"),
	};
}

/** 只保存启用层，固定顺序供 Cookie 与首帧属性共用。 */
export const serializeDecorationLayers = (layers: DecorationLayers): string =>
	DECORATION_LAYERS.filter((layer) => layers[layer]).join(",") || "none";

export const getClientDecorationLayers = (): DecorationLayers =>
	parseDecorationLayersCookie(document.cookie);

/** 开关不改装饰季节；写入完成后路由与下次 SSR 才能读到同一状态。 */
export const persistDecorationLayers = (layers: DecorationLayers): Promise<void> =>
	writePreferenceCookie(DECORATION_LAYERS_COOKIE_NAME, serializeDecorationLayers(layers));

const isDecorationPreference = (value: unknown): value is DecorationPreference =>
	(DECORATION_PREFERENCES as readonly unknown[]).includes(value);

/** 读取装饰偏好 cookie；缺失或非法值回落为跟随主题。 */
export function parseDecorationCookie(cookie: string): DecorationPreference {
	const value = readCookieValue(cookie, DECORATION_COOKIE_NAME);
	return isDecorationPreference(value) ? value : "theme";
}

/**
 * 实际投放的季节装饰；null 表示不显示。
 *
 * 跟随主题时取预设主题的季节；自定义主题没有对应季节，跟随主题时不显示。
 */
export function resolveDecoration(
	decoration: DecorationPreference,
	theme: Pick<ThemeState, "preset" | "custom">,
): Season | null {
	if (decoration === "none") return null;
	if (decoration === "theme") return theme.custom ? null : theme.preset;
	return decoration;
}

/** 客户端路由读取装饰偏好。 */
export const getClientDecoration = (): DecorationPreference =>
	parseDecorationCookie(document.cookie);

/** 写入装饰偏好 cookie，供后续 SSR 确定首帧装饰；写入完成后才 resolve。 */
export const persistDecorationPreference = (decoration: DecorationPreference): Promise<void> =>
	writePreferenceCookie(DECORATION_COOKIE_NAME, decoration);
