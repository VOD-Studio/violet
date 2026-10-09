import type { Style } from "./core/types.ts";
import { fillHands, hands } from "./hand/presets.ts";
import { pens } from "./pen/fineliner.ts";

/** 内置风格：签字笔配三档手法；填充缺省为实色，可用 `{ ...styles.natural, fill }` 替换。 */
export const styles = {
	neat: { hand: hands.neat, fillHand: fillHands.neat, pen: pens.fineliner },
	natural: { hand: hands.natural, fillHand: fillHands.natural, pen: pens.fineliner },
	draft: { hand: hands.draft, fillHand: fillHands.draft, pen: pens.fineliner },
} as const satisfies Record<string, Style>;
