import type { Style } from "./core/types.ts";
import { createWashFill } from "./fill/wash.ts";
import { fillHands, hands } from "./hand/presets.ts";
import { gpen } from "./pen/brushes.ts";

/**
 * 线稿淡彩：勾线手法、G 笔与淡彩填充的组合，即日系插画的细墨线稿配浅色平涂。
 * 排线沿用同一支笔，换笔或调压感时一并生效。
 *
 * @remarks 不放进 `styles`：对象属性无法单独摇树，会把 G 笔与淡彩带进默认用法。
 *
 * @example
 * ```ts
 * const softer = { ...lineWashStyle, pen: createGPen({ pressure: 0.6 }) };
 * ```
 */
export const lineWashStyle: Style = /* @__PURE__ */ {
	hand: hands.inking,
	fillHand: fillHands.inking,
	pen: gpen,
	fill: /* @__PURE__ */ createWashFill(),
	fillWeight: 0.55,
};
