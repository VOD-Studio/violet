import { computeBlockId } from "./block-id";
import { getBlockText } from "./extract-blocks";
import { buildAnchorFromRange } from "./range-to-anchor";
import { isAnnotatableBlock } from "./selection-to-anchor";
import type { Anchor } from "./types";

/** 整段批注的锚点，区间覆盖整块文字；这一块无法批注时为 null。 */
export async function buildBlockAnchor(block: HTMLElement): Promise<Anchor | null> {
	if (!isAnnotatableBlock(block)) return null;
	const text = getBlockText(block);
	const blockId = await computeBlockId(text);
	return buildAnchorFromRange({
		blockId,
		blockText: text,
		startOffset: 0,
		endOffset: text.length,
	});
}
