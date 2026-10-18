import {
	type KeyboardEvent as ReactKeyboardEvent,
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useState,
} from "react";
import {
	type AutoSortEntry,
	applyMove,
	type BoardPosition,
	type BoardState,
	createMove,
	isNoopMove,
	locateCard,
	type StepDirection,
	stepTarget,
} from "../../core/index.ts";
import type { BoardMessages } from "../messages.ts";
import type { ActivityRef } from "./activity.ts";
import { findCard } from "./dom.ts";
import type { useAnnouncer } from "./use-announcer.ts";
import type { BoardMoves } from "./use-board-moves.ts";
import type { useFocusRequest } from "./use-focus-request.ts";
import { useLatest } from "./use-latest.ts";

/** `useKeyboardMove` 的输入。 */
export interface KeyboardMoveOptions {
	rootRef: RefObject<HTMLElement | null>;
	moves: BoardMoves;
	columnIds: readonly string[];
	autoSort: (columnId: string) => AutoSortEntry | undefined;
	messages: BoardMessages;
	activity: ActivityRef;
	announce: ReturnType<typeof useAnnouncer>["announce"];
	focus: ReturnType<typeof useFocusRequest>;
}

/** 键盘拿起的卡片：出发位置与当前预览的目标位置。 */
interface Lifted {
	cardId: string;
	origin: BoardPosition;
	target: BoardPosition;
}

/** `useKeyboardMove` 给看板渲染用的状态与操作。 */
export interface KeyboardMove {
	/** 当前显示的顺序：已拿起的卡片按预览位置显示，放下前不提交。 */
	order: BoardState["order"];
	liftedId: string | null;
	/** 卡片自身获得焦点时按空格或 Enter 拿起。 */
	onCardKeyDown(event: ReactKeyboardEvent<HTMLElement>, cardId: string): void;
}

const DIRECTIONS: Record<string, StepDirection> = {
	ArrowUp: "up",
	ArrowDown: "down",
	ArrowLeft: "left",
	ArrowRight: "right",
};

const isActivateKey = (key: string) => key === " " || key === "Enter";

/** 带修饰键的组合是浏览器与页面的快捷键（例如 Alt+方向键翻历史），输入法组合期间的按键也不属于我们。 */
const isForeignKey = (event: {
	ctrlKey: boolean;
	metaKey: boolean;
	altKey: boolean;
	isComposing: boolean;
}) => event.ctrlKey || event.metaKey || event.altKey || event.isComposing;

/**
 * 键盘移动：拿起后每一步直接按新位置显示（预览），放下才提交，Esc 恢复。
 *
 * 与指针拖拽不同，被拿起的卡片必须一直保持焦点，所以它不隐藏，而是在每次位置变化后把焦点还给它。
 * 焦点离开这张卡片（Tab、点击别处）即取消。
 */
export function useKeyboardMove(options: KeyboardMoveOptions): KeyboardMove {
	const { rootRef, moves, columnIds } = options;
	const [lifted, setLifted] = useState<Lifted | null>(null);
	const live = useLatest({ options, lifted });

	const finish = useCallback(
		(cardId: string, refocus: boolean) => {
			const { options: current } = live.current;
			setLifted(null);
			current.activity.current = null;
			if (refocus) current.focus.request(cardId);
		},
		[live],
	);

	const cancel = useCallback(
		(refocus = true) => {
			const { options: current, lifted: held } = live.current;
			if (!held) return;
			finish(held.cardId, refocus);
			current.announce("keyboardCancelled", held.cardId, held.origin);
		},
		[live, finish],
	);

	const pickUp = useCallback(
		(cardId: string) => {
			const { options: current, lifted: held } = live.current;
			if (!current.moves.editable || held || current.activity.current) return;
			const origin = locateCard(current.moves.state(), cardId);
			if (!origin) return;
			current.activity.current = "keyboard";
			setLifted({ cardId, origin, target: origin });
			current.announce("keyboardPickedUp", cardId, origin);
		},
		[live],
	);

	const step = useCallback(
		(direction: StepDirection) => {
			const { options: current, lifted: held } = live.current;
			if (!held) return;
			const { moves: board, messages, announce } = current;
			const base = board.state();
			const result = stepTarget(
				base,
				held.cardId,
				held.origin,
				held.target,
				direction,
				current.autoSort,
			);
			if (result.kind === "edge") return announce("keyboardAtEdge", held.cardId, held.target);
			if (result.kind === "autoSorted") return board.showNotice(messages.autoSorted);
			const move = createMove(base, held.cardId, result.target);
			if (!move) return;
			const verdict = board.decide(move);
			if (!verdict.allowed) return board.showNotice(verdict.reason);
			setLifted({ ...held, target: move.to });
			announce("keyboardMoved", held.cardId, move.to);
		},
		[live],
	);

	const drop = useCallback(() => {
		const { options: current, lifted: held } = live.current;
		if (!held) return;
		const { moves: board, announce, focus } = current;
		// 拿起期间看板变成只读（例如开始筛选）：不再提交
		if (!board.editable) return cancel();
		finish(held.cardId, true);
		const move = createMove(board.state(), held.cardId, held.target);
		if (!move || isNoopMove(move)) return announce("keyboardDropped", held.cardId, held.origin);
		// 放下时再判定一次，规则可能在拿起期间变了
		const verdict = board.decide(move);
		if (!verdict.allowed) {
			board.showNotice(verdict.reason);
			return announce("keyboardCancelled", held.cardId, held.origin);
		}
		board.commit(move, () => focus.restore(held.cardId));
		announce("keyboardDropped", held.cardId, move.to);
	}, [live, finish, cancel]);

	// 拿起期间：方向键、空格、Enter、Esc 归键盘移动，不传给页面级快捷键；焦点离开这张卡片则取消
	const isLifted = lifted !== null;
	const liftedId = lifted?.cardId;
	useEffect(() => {
		const root = rootRef.current;
		if (!isLifted || !liftedId || !root) return;
		const onKey = (event: KeyboardEvent) => {
			// 只处理发给被拿起卡片本身的按键，卡片里的输入框、按钮等自己处理自己的
			if (isForeignKey(event) || event.target !== findCard(root, liftedId)) return;
			if (event.key === "Tab") return cancel(false);
			const direction = DIRECTIONS[event.key];
			const action = isActivateKey(event.key) ? drop : event.key === "Escape" ? cancel : null;
			if (!direction && !action) return;
			event.preventDefault();
			event.stopPropagation();
			event.stopImmediatePropagation();
			// 按住不放产生的重复事件不能连续放下、取消
			if (event.repeat && action) return;
			if (direction) step(direction);
			else action?.();
		};
		// 跨列移动会让焦点所在的卡片重新挂载，焦点在布局副作用里被还回；这里等它还回来再判断是否真的离开
		const onFocusOut = () =>
			setTimeout(() => {
				if (document.activeElement !== findCard(root, liftedId)) cancel(false);
			}, 0);
		window.addEventListener("keydown", onKey, true);
		root.addEventListener("focusout", onFocusOut);
		return () => {
			window.removeEventListener("keydown", onKey, true);
			root.removeEventListener("focusout", onFocusOut);
		};
	}, [isLifted, liftedId, rootRef, drop, cancel, step]);

	// 看板中途变成只读：放弃拿起
	useEffect(() => {
		if (isLifted && !moves.editable) cancel();
	}, [isLifted, moves.editable, cancel]);

	// 预览位置变化后卡片可能重新挂载，焦点要跟着它
	useLayoutEffect(() => {
		const root = rootRef.current;
		if (!lifted || !root) return;
		const element = findCard(root, lifted.cardId);
		if (element && document.activeElement !== element) element.focus();
	}, [lifted, rootRef]);

	const onCardKeyDown = useCallback(
		(event: ReactKeyboardEvent<HTMLElement>, cardId: string) => {
			// 卡片里的按钮、链接等自己处理自己的按键
			if (event.target !== event.currentTarget) return;
			if (!isActivateKey(event.key) || isForeignKey(event.nativeEvent)) return;
			event.preventDefault();
			event.stopPropagation();
			if (!event.repeat) pickUp(cardId);
		},
		[pickUp],
	);

	const state = { columns: columnIds, order: moves.order };
	const previewMove = lifted && createMove(state, lifted.cardId, lifted.target);
	return {
		order: previewMove ? applyMove(state, previewMove).order : moves.order,
		liftedId: lifted?.cardId ?? null,
		onCardKeyDown,
	};
}
