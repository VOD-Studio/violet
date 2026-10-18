import { useCallback } from "react";
import type { AutoSortEntry } from "../../core/index.ts";
import { createMove, entryIndex, locateCard } from "../../core/index.ts";
import type { useAnnouncer } from "./use-announcer.ts";
import type { BoardMoves } from "./use-board-moves.ts";
import type { useFocusRequest } from "./use-focus-request.ts";
import { useLatest } from "./use-latest.ts";

export interface MoveMenuOptions {
	moves: BoardMoves;
	autoSort: (columnId: string) => AutoSortEntry | undefined;
	announce: ReturnType<typeof useAnnouncer>["announce"];
	focus: ReturnType<typeof useFocusRequest>;
}

/**
 * 「移到…」菜单的选择结果：把卡片移到目标列的入口端（自动排序列）或末尾。
 *
 * 与拖拽走同一套规则与提交；卡片重新挂载后焦点还给它。
 */
export function useMoveMenu(options: MoveMenuOptions) {
	const live = useLatest(options);
	return useCallback(
		(cardId: string, columnId: string) => {
			const { moves, autoSort, announce, focus } = live.current;
			const base = moves.state();
			const origin = locateCard(base, cardId);
			if (!origin || origin.columnId === columnId) return;
			const entry = autoSort(columnId);
			const length = (base.order[columnId] ?? []).length;
			const move = createMove(base, cardId, {
				columnId,
				index: entry ? entryIndex(entry, length) : length,
			});
			if (!move) return;
			const verdict = moves.decide(move);
			if (!verdict.allowed) return moves.showNotice(verdict.reason);
			moves.commit(move, () => focus.restore(cardId));
			announce("movedByMenu", cardId, move.to);
			focus.request(cardId);
		},
		[live],
	);
}
