import { LINE } from "./core/color.ts";
import type { Style } from "./core/types.ts";
import { createCartoonFill } from "./fill/cartoon.ts";
import { createHand } from "./hand/presets.ts";
import { createInkPen } from "./pen/brushes.ts";

/** 卡通勾线手法：低抖动、少断笔，起收笔明显收尖。 */
export const cartoonHand = /* @__PURE__ */ createHand(
	{
		roughness: 0.5,
		bowing: 0.6,
		breakChance: 0.1,
		overshoot: 0.5,
		taper: 14,
		tip: 0.05,
		pressureNoise: 0.12,
	},
	"cartoon",
);

/**
 * 卡通风格：压感钢笔、赛璐璐填充与色线的组合，需配合 {@link import("./core/color.ts").cartoonPalette} 派生的配色。
 */
export const cartoonStyle: Style = /* @__PURE__ */ {
	hand: cartoonHand,
	pen: /* @__PURE__ */ createInkPen(1.5),
	fill: /* @__PURE__ */ createCartoonFill(),
	lineRole: (fillRole) => (fillRole ? fillRole + LINE : "ink"),
};
