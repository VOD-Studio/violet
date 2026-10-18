import { type AutoSortEntry, type BoardPosition, entryIndex } from "./moves.ts";
import type { BoardState } from "./state.ts";

/** 键盘移动的方向。 */
export type StepDirection = "up" | "down" | "left" | "right";

/** 键盘移动一步的结果。 */
export type StepResult =
	| { kind: "moved"; target: BoardPosition }
	| { kind: "edge" }
	| { kind: "autoSorted" };

/**
 * 键盘移动一步后的目标位置。
 *
 * 上下在列内移动一格；左右换到相邻列，保持纵向序号并收敛到列长。自动排序列里不能上下移动，
 * 别的列的卡片进入它时落在入口一端，回到出发的自动排序列则回到出发的位置。
 *
 * @param origin - 卡片出发的位置
 * @param current - 卡片当前预览的位置
 * @param autoSort - 某列的自动排序入口，普通列为 undefined
 */
export function stepTarget(
	state: BoardState,
	cardId: string,
	origin: BoardPosition,
	current: BoardPosition,
	direction: StepDirection,
	autoSort: (columnId: string) => AutoSortEntry | undefined,
): StepResult {
	const lengthOf = (columnId: string) =>
		(state.order[columnId] ?? []).filter((id) => id !== cardId).length;
	if (direction === "up" || direction === "down") {
		if (autoSort(current.columnId)) return { kind: "autoSorted" };
		const index = current.index + (direction === "up" ? -1 : 1);
		if (index < 0 || index > lengthOf(current.columnId)) return { kind: "edge" };
		return { kind: "moved", target: { columnId: current.columnId, index } };
	}
	const columnId =
		state.columns[state.columns.indexOf(current.columnId) + (direction === "left" ? -1 : 1)];
	if (columnId === undefined) return { kind: "edge" };
	const entry = autoSort(columnId);
	const length = lengthOf(columnId);
	let index = Math.min(current.index, length);
	if (entry) index = columnId === origin.columnId ? origin.index : entryIndex(entry, length);
	return { kind: "moved", target: { columnId, index } };
}
