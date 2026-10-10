import type { Style } from "./core/types.ts";
import { createWashFill } from "./fill/wash.ts";
import { fillHands, hands } from "./hand/presets.ts";
import { createInkPen } from "./pen/brushes.ts";

/** 动漫勾线手法，即 {@link hands.inking}。 */
export const animeHand = hands.inking;

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
		fillHand: fillHands.inking,
		fillWeight: 0.75,
		lineRole: () => "ink",
	};
}

/** 默认动漫风格。 */
export const animeStyle: Style = /* @__PURE__ */ createAnimeStyle();
