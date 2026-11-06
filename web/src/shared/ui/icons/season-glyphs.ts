import type { Season } from "@shared/lib/theme-preference";
import { createLucideIcon, type LucideProps } from "lucide-react";
import { createElement } from "react";

/** 花瓣与叶片是实心形，只填色、不描边；中心圆点取卡片底色，让花瓣围出花心。 */
const solid = { fill: "currentColor", stroke: "none" } as const;
const core = { r: "1.6", cx: "12", cy: "12", fill: "var(--card)", stroke: "none" } as const;

/** 春：五瓣花，瓣心距花心 4.6、瓣半径 3.4，中心一个底色圆点。 */
export const SpringGlyph = /* @__PURE__ */ createLucideIcon("season-spring", [
	["circle", { cx: "12", cy: "7.4", r: "3.4", ...solid, key: "p0" }],
	["circle", { cx: "16.37", cy: "10.58", r: "3.4", ...solid, key: "p1" }],
	["circle", { cx: "14.7", cy: "15.72", r: "3.4", ...solid, key: "p2" }],
	["circle", { cx: "9.3", cy: "15.72", r: "3.4", ...solid, key: "p3" }],
	["circle", { cx: "7.63", cy: "10.58", r: "3.4", ...solid, key: "p4" }],
	["circle", { ...core, key: "core" }],
]);

/** 夏：半径 7.5 的实心圆，从圆心指向 12 点钟方向的指针取卡片底色。 */
export const SummerGlyph = /* @__PURE__ */ createLucideIcon("season-summer", [
	["circle", { cx: "12", cy: "12", r: "7.5", ...solid, key: "disc" }],
	["path", { d: "M12 12V4.5", stroke: "var(--card)", strokeLinecap: "round", key: "pointer" }],
]);

/** 秋：四瓣叶，叶心距花心 4.2、叶半径 3.6，中心一个底色圆点。 */
export const AutumnGlyph = /* @__PURE__ */ createLucideIcon("season-autumn", [
	["circle", { cx: "12", cy: "7.8", r: "3.6", ...solid, key: "p0" }],
	["circle", { cx: "16.2", cy: "12", r: "3.6", ...solid, key: "p1" }],
	["circle", { cx: "12", cy: "16.2", r: "3.6", ...solid, key: "p2" }],
	["circle", { cx: "7.8", cy: "12", r: "3.6", ...solid, key: "p3" }],
	["circle", { ...core, key: "core" }],
]);

/** 冬：雪花，三条贯穿的轴加上下两处枝尖，只描边。 */
export const WinterGlyph = /* @__PURE__ */ createLucideIcon("season-winter", [
	[
		"path",
		{
			d: "M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M10 4.5l2 2 2-2M10 19.5l2-2 2 2",
			key: "flake",
		},
	],
]);

const GLYPHS = {
	spring: SpringGlyph,
	summer: SummerGlyph,
	autumn: AutumnGlyph,
	winter: WinterGlyph,
} as const satisfies Record<Season, typeof SpringGlyph>;

/** {@link SeasonGlyph} 的属性：标准图标属性加上季节。 */
export interface SeasonGlyphProps extends LucideProps {
	/** 要画的季节。 */
	season: Season;
}

/**
 * 当季花形图标，颜色取 `currentColor`，花心与指针取卡片底色。
 *
 * @remarks 线宽默认 1.8（设计稿的雪花线宽），其余属性与 lucide 图标一致，可用 `strokeWidth` 覆盖。
 */
export function SeasonGlyph({ season, ...props }: SeasonGlyphProps) {
	return createElement(GLYPHS[season], { strokeWidth: 1.8, ...props });
}
