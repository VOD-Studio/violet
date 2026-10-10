import type { Style } from "./core/types.ts";
import { createWashFill } from "./fill/wash.ts";
import { createHand } from "./hand/presets.ts";
import { createInkPen } from "./pen/brushes.ts";

/**
 * 动漫勾线手法：线条稳而少抖，长线由多段短笔接成，笔间时而留白时而交叠；
 * 转角大多断笔并交叉越界，起收笔压力降到 0。
 */
export const animeHand = /* @__PURE__ */ createHand(
	{
		roughness: 0.4,
		bowing: 0.5,
		breakChance: 0.8,
		overshoot: 2.2,
		overshootLimit: 6,
		overlap: [-0.04, 0.03],
		segment: [24, 95],
		gap: [0.6, 5.5],
		taper: 9,
		tip: 0,
		pressureNoise: 0.16,
	},
	"anime",
);

/** 排线手法：短直，起收笔压力降到 0。 */
const hatchHand = /* @__PURE__ */ createHand(
	{
		roughness: 0.15,
		bowing: 0.3,
		breakChance: 0,
		overshoot: 0,
		taper: 2.5,
		tip: 0.05,
		pressureNoise: 0.1,
	},
	"anime-hatch",
);

/** 动漫风格参数。 */
export interface AnimeOptions {
	/** 线稿与排线的压感强度，[0, 1]；0 为恒宽。 @default 0.95 */
	pressure?: number;
}

/**
 * 创建动漫风格（线稿淡彩）：钢笔细墨线稿配浅色平涂，朝光侧留纸白，背光侧以短排线代替阴影色块。
 * 线稿与排线取 `ink`，平涂取图元的填充角色，不需要派生色。
 *
 * @example
 * ```ts
 * const steady = createAnimeStyle({ pressure: 0.4 });
 * ```
 */
export function createAnimeStyle(options: AnimeOptions = {}): Style {
	// 漫画勾线的 G 笔本是蘸水钢笔：起收笔收尖、中段饱满
	const pen = createInkPen({ weight: 0.57, pressure: options.pressure ?? 0.95 });
	return {
		hand: animeHand,
		pen,
		fill: createWashFill(),
		fillHand: hatchHand,
		// 生成器以填充角色调用填充笔；排线与线稿同墨，改写为 ink。
		fillPen: { id: "anime-hatch", ink: (strokes, ctx) => pen.ink(strokes, ctx, "ink") },
		fillWeight: 0.75,
		lineRole: () => "ink",
	};
}

/** 默认动漫风格。 */
export const animeStyle: Style = /* @__PURE__ */ createAnimeStyle();
