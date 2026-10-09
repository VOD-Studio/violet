import type { Hand, Stroke } from "../core/types.ts";
import { type GestureOptions, traceStroke } from "./gesture.ts";
import { type PlanOptions, planStrokes } from "./plan.ts";

/** 内置手法的全部参数；未给出的项取「自然」预设。 */
export interface HandOptions extends PlanOptions, GestureOptions {}

// 抬笔到下一笔落笔的停顿，与笔画时间同为弧长单位。
const LIFT_PAUSE = 30;

const natural: HandOptions = {
	roughness: 0.9,
	bowing: 1,
	breakChance: 0.6,
	overshoot: 1,
	overlap: [0.04, 0.1],
	maxStroke: 360,
	passes: 1,
};

/**
 * 创建基于笔画规划与最小 jerk 轨迹的手法。
 *
 * @example
 * ```ts
 * const shaky = createHand({ roughness: 2.4, passes: 2 });
 * ```
 */
export function createHand(options: Partial<HandOptions> = {}, id = "hand"): Hand {
	const resolved: HandOptions = { ...natural, ...options };
	return {
		id,
		strokes(skeleton, ctx) {
			const strokes: Stroke[] = [];
			let time = 0;
			for (const plan of planStrokes(skeleton, ctx, resolved)) {
				const stroke = traceStroke(plan, ctx, resolved, time);
				strokes.push(stroke);
				time = stroke.points[stroke.points.length - 1] + LIFT_PAUSE;
			}
			return strokes;
		},
	};
}

/** 内置手法预设。 */
export const hands = {
	/** 工整：低抖动，少断笔。 */
	neat: createHand({ roughness: 0.35, bowing: 0.4, breakChance: 0.3, overshoot: 0.4 }, "neat"),
	/** 自然：默认手法。 */
	natural: createHand({}, "natural"),
	/** 草稿：大幅抖动并复画一遍。 */
	draft: createHand(
		{ roughness: 1.8, bowing: 1.6, breakChance: 0.85, overshoot: 1.5, passes: 2 },
		"draft",
	),
} as const;

/** 与各手法预设配套的填充手法：粗糙度减半，不断笔、不越界、不复画。 */
export const fillHands = {
	neat: createHand({ roughness: 0.2, bowing: 0.3, breakChance: 0, overshoot: 0 }, "neat-fill"),
	natural: createHand(
		{ roughness: 0.45, bowing: 0.6, breakChance: 0, overshoot: 0 },
		"natural-fill",
	),
	draft: createHand({ roughness: 0.9, bowing: 1, breakChance: 0, overshoot: 0 }, "draft-fill"),
} as const;
