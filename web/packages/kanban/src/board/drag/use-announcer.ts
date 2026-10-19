import { useCallback, useState } from "react";
import type { BoardPosition } from "../../core/index.ts";
import { formatMessage } from "../../locale.ts";
import type { BoardMessages } from "../messages.ts";
import type { BoardMoves } from "./use-board-moves.ts";
import { useLatest } from "./use-latest.ts";

/** 播报的种类，对应 `BoardMessages` 里的键。 */
export type AnnounceKind =
	| "keyboardPickedUp"
	| "keyboardMoved"
	| "keyboardAtEdge"
	| "keyboardDropped"
	| "keyboardCancelled"
	| "movedByMenu";

export interface AnnouncerOptions {
	moves: BoardMoves;
	cardLabel: (cardId: string) => string;
	columnTitle: (columnId: string) => string;
	messages: BoardMessages;
}

/** 屏幕阅读器播报：描述卡片放在某个位置后的名称、列、位置与该列卡片数。 */
export function useAnnouncer(options: AnnouncerOptions) {
	const [announcement, setAnnouncement] = useState({ text: "", seq: 0 });
	const latest = useLatest(options);
	const announce = useCallback(
		(kind: AnnounceKind, cardId: string, position: BoardPosition) => {
			const { moves, cardLabel, columnTitle, messages } = latest.current;
			const others = (moves.state().order[position.columnId] ?? []).filter(
				(id) => id !== cardId,
			).length;
			const text = formatMessage(messages[kind], {
				card: cardLabel(cardId),
				column: columnTitle(position.columnId),
				position: position.index + 1,
				count: others + 1,
			});
			setAnnouncement((previous) => ({ text, seq: previous.seq + 1 }));
		},
		[latest],
	);
	return { announcement, announce };
}
