import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
	type AutoSortEntry,
	applyMove,
	type BoardMove,
	type BoardState,
	isNoopMove,
	violatesAutoSort,
} from "../../core/index.ts";
import type { BoardMessages } from "../messages.ts";

/** `canMove` 的裁决：允许，或拒绝并给出原因。 */
export type MoveDecision = { allowed: true } | { allowed: false; reason?: string };

/** `useBoardMoves` 的输入：看板的数据与规则回调。 */
export interface BoardMovesOptions {
	columnIds: readonly string[];
	/** 使用方给出的顺序。 */
	order: BoardState["order"];
	autoSort: (columnId: string) => AutoSortEntry | undefined;
	onMove?: (move: BoardMove) => void | Promise<void>;
	canMove?: (move: BoardMove) => MoveDecision;
	onMoveError?: (error: unknown, move: BoardMove) => void;
	readOnly?: boolean;
	messages: BoardMessages;
}

/** 移动的共用部分：规则判定、乐观显示、提交与回滚、提示。指针拖拽与键盘移动都通过它提交。 */
export interface BoardMoves {
	editable: boolean;
	/** 当前显示的顺序：使用方的 `order` 加上尚未完成的移动。 */
	order: BoardState["order"];
	notice: string;
	showNotice(text: string): void;
	/** 当前显示顺序对应的看板状态。 */
	state(): BoardState;
	/** 内置规则与 `canMove` 对一次移动的裁决；`canMove` 抛错按拒绝处理。 */
	decide(move: BoardMove): MoveDecision;
	/**
	 * 提交一次移动：按新顺序显示，直到 `onMove` 完成；失败则回滚、触发 `onMoveError` 并提示。
	 *
	 * @param onRollback - 失败回滚时调用
	 */
	commit(move: BoardMove, onRollback?: () => void): void;
}

/** 提示停留的时间（ms），够读完一句话。 */
const NOTICE_MS = 4000;

function useNotice() {
	const [text, setText] = useState("");
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const mounted = useRef(false);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
			clearTimeout(timer.current);
		};
	}, []);
	const show = useCallback((message: string) => {
		if (!mounted.current) return;
		clearTimeout(timer.current);
		setText(message);
		timer.current = setTimeout(() => setText(""), NOTICE_MS);
	}, []);
	return [text, show] as const;
}

/**
 * 看板由使用方控制：放下后先按新顺序显示，直到 `onMove` 完成；失败则回滚。
 * 完成之后只认使用方的 `order`，所以使用方要在 `onMove` 完成前更新它。
 */
export function useBoardMoves(options: BoardMovesOptions): BoardMoves {
	const { columnIds, order } = options;
	const editable = Boolean(options.onMove) && !options.readOnly;
	const [pending, setPending] = useState<Array<{ token: number; move: BoardMove }>>([]);
	const [notice, showNotice] = useNotice();
	const effectiveOrder = pending.reduce<BoardState["order"]>(
		(current, { move }) => applyMove({ columns: columnIds, order: current }, move).order,
		order,
	);

	const live = useRef({ options, columnIds, effectiveOrder });
	useLayoutEffect(() => {
		live.current = { options, columnIds, effectiveOrder };
	});
	const tokens = useRef(0);

	const state = useCallback(
		(): BoardState => ({
			columns: live.current.columnIds,
			order: live.current.effectiveOrder,
		}),
		[],
	);

	const decide = useCallback((move: BoardMove): MoveDecision => {
		const { options: current } = live.current;
		if (isNoopMove(move)) return { allowed: true };
		if (violatesAutoSort(move, (id) => current.autoSort(id) !== undefined))
			return { allowed: false, reason: current.messages.autoSorted };
		try {
			const verdict = current.canMove?.(move);
			if (verdict && !verdict.allowed)
				return { allowed: false, reason: verdict.reason ?? current.messages.moveRejected };
		} catch {
			// 使用方的规则出错时按拒绝处理，交互本身不能因此中断
			return { allowed: false, reason: current.messages.moveRejected };
		}
		return { allowed: true };
	}, []);

	const commit = useCallback(
		(move: BoardMove, onRollback?: () => void) => {
			const { options: current } = live.current;
			const token = ++tokens.current;
			setPending((list) => [...list, { token, move }]);
			let result: void | Promise<void>;
			try {
				result = current.onMove?.(move);
			} catch (error) {
				result = Promise.reject(error);
			}
			const settle = () =>
				setPending((list) => list.filter((entry) => entry.token !== token));
			Promise.resolve(result).then(settle, (error: unknown) => {
				settle();
				onRollback?.();
				current.onMoveError?.(error, move);
				showNotice(current.messages.moveFailed);
			});
		},
		[showNotice],
	);

	return { editable, order: effectiveOrder, notice, showNotice, state, decide, commit };
}
