import type { Style } from "./core/types.ts";
import { fillHands, hands } from "./hand/presets.ts";
import { fineliner } from "./pen/fineliner.ts";

/**
 * 内置风格：签字笔配三档手法，填充缺省为实色，可用 `{ ...styles.natural, fill }` 替换。
 * 线稿淡彩见 {@link import("./line-wash.ts").lineWashStyle}。
 */
export const styles = {
	neat: { hand: hands.neat, fillHand: fillHands.neat, pen: fineliner, fillPen: fineliner },
	natural: {
		hand: hands.natural,
		fillHand: fillHands.natural,
		pen: fineliner,
		fillPen: fineliner,
	},
	draft: { hand: hands.draft, fillHand: fillHands.draft, pen: fineliner, fillPen: fineliner },
} as const satisfies Record<string, Style>;
