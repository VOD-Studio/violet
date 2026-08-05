/**
 * anchor-mapper —— 把后端 Comment.anchor（snake_case）与前端 lib Anchor（camelCase）互转。
 *
 * lib/types.ts 注释承诺过的转换层，集中在 lib 层供 AnnotationLayer/Sidebar 共用。
 */
import type { CommentAnchor } from "@entities/comment/model/types";
import type { Anchor } from "./types";

/** CommentAnchor（snake_case 后端契约）→ Anchor（camelCase 前端内部）。 */
export function fromCommentAnchor(a: CommentAnchor): Anchor {
	return {
		blockId: a.block_id,
		startOffset: a.start_offset,
		endOffset: a.end_offset,
		selectedText: a.selected_text,
		blockTextHash: a.block_text_hash,
	};
}

/** Anchor（camelCase 前端内部）→ CreateComment.anchor（snake_case 后端契约）。 */
export function toCreateCommentAnchor(a: Anchor) {
	return {
		block_id: a.blockId,
		start_offset: a.startOffset,
		end_offset: a.endOffset,
		selected_text: a.selectedText,
		block_text_hash: a.blockTextHash,
	};
}
