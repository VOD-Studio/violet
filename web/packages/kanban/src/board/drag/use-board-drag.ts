import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
	type AutoSortEntry,
	applyMove,
	type BoardMove,
	type BoardPosition,
	type BoardState,
	createMove,
	isNoopMove,
	locateCard,
	type Point,
	resolveDropTarget,
	violatesAutoSort,
} from "../../core/index.ts";
import type { BoardMessages } from "../messages.ts";
import { CARD_SELECTOR, findCard, measureColumns } from "./dom.ts";
import { MOTION_EASING, MOTION_MS, prefersReducedMotion, useFlip } from "./motion.ts";
import { createPointerController } from "./pointer-controller.ts";
import type { DragController, DragHost } from "./types.ts";

/** `canMove` 的裁决：允许，或拒绝并给出原因。 */
export type MoveDecision = { allowed: true } | { allowed: false; reason?: string };

/** `useBoardDrag` 的输入：看板的数据、规则回调与 DOM 引用。 */
export interface BoardDragOptions {
	rootRef: RefObject<HTMLElement | null>;
	scrollerRef: RefObject<HTMLElement | null>;
	columnIds: readonly string[];
	/** 使用方给出的顺序。 */
	order: BoardState["order"];
	autoSort: (columnId: string) => AutoSortEntry | undefined;
	onMove?: (move: BoardMove) => void | Promise<void>;
	canMove?: (move: BoardMove) => MoveDecision;
	onMoveError?: (error: unknown, move: BoardMove) => void;
	readOnly?: boolean;
	controller?: DragController;
	messages: BoardMessages;
}

interface Size {
	width: number;
	height: number;
}

/** 被抓起的卡片：出发位置与抓起时的尺寸。 */
interface Grabbed {
	cardId: string;
	origin: BoardPosition;
	size: Size;
}

/** 拖拽中的视图状态。 */
export interface DragView extends Grabbed {
	/** 占位所在位置；落点被拒绝或在看板之外时回到出发位置。 */
	placeholder: BoardPosition;
	/** 当前落点被规则拒绝；在看板之外不算拒绝。 */
	invalid: boolean;
}

/** `useBoardDrag` 给看板渲染用的状态。 */
export interface BoardDrag {
	editable: boolean;
	/** 当前显示的顺序：使用方的 `order` 加上尚未完成的移动。 */
	order: BoardState["order"];
	dragging: DragView | null;
	/** 正在落位的卡片，其位置已确定但要等浮起卡片飞到才显现。 */
	settlingId: string | null;
	/** 浮起卡片：拖拽与落位期间存在。 */
	ghost: Grabbed | null;
	ghostRef: RefObject<HTMLDivElement | null>;
	notice: string;
}

type Session = ({ phase: "dragging" } & DragView) | ({ phase: "settling" } & Grabbed);

interface Runtime extends Grabbed {
	pointer: Point;
	/** 抓取点相对卡片左上角的偏移。 */
	grab: Point;
	/** 浮起卡片在 transform 为 none 时的屏幕位置，用来抵消祖先 transform 造成的定位偏差。 */
	ghostOffset: Point;
	ghostReady: boolean;
	/** 上次求值的落点，落点不变时不重复调用 `canMove`。 */
	targetKey: string;
	/** 当前落点对应的有效移动；没有落点或被拒绝时为 null。 */
	move: BoardMove | null;
	reason: string | undefined;
}

const defaultController = createPointerController();

const NO_DRAG_SELECTOR =
	'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [data-kanban-no-drag]';

/** 提示停留的时间（ms），够读完一句话。 */
const NOTICE_MS = 4000;

function placeGhost(ghost: HTMLElement | null, run: Runtime) {
	if (!ghost || !run.ghostReady) return;
	const x = run.pointer.x - run.grab.x - run.ghostOffset.x;
	const y = run.pointer.y - run.grab.y - run.ghostOffset.y;
	ghost.style.transform = `translate(${x}px, ${y}px)`;
}

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
 * 看板的拖拽编排：把控制器的拖拽指令变成落点、占位、浮起卡片、位置过渡与移动事件。
 *
 * 看板由使用方控制：放下后先按新顺序显示，直到 `onMove` 完成；失败则回滚。
 * 完成之后只认使用方的 `order`，所以使用方要在 `onMove` 完成前更新它。
 */
export function useBoardDrag(options: BoardDragOptions): BoardDrag {
	const { rootRef, scrollerRef, columnIds, order, controller = defaultController } = options;
	const editable = Boolean(options.onMove) && !options.readOnly;

	const [pending, setPending] = useState<Array<{ token: number; move: BoardMove }>>([]);
	const [session, setSession] = useState<Session | null>(null);
	const [notice, showNotice] = useNotice();
	const effectiveOrder = pending.reduce<BoardState["order"]>(
		(current, { move }) => applyMove({ columns: columnIds, order: current }, move).order,
		order,
	);

	const live = useRef({ options, columnIds, effectiveOrder });
	useLayoutEffect(() => {
		live.current = { options, columnIds, effectiveOrder };
	});
	const run = useRef<Runtime | null>(null);
	const ghostRef = useRef<HTMLDivElement | null>(null);
	const tokens = useRef(0);

	useEffect(() => {
		const root = rootRef.current;
		if (!root || !editable) return;

		const state = (): BoardState => ({
			columns: live.current.columnIds,
			order: live.current.effectiveOrder,
		});

		const decide = (move: BoardMove): MoveDecision => {
			const { options: current } = live.current;
			if (isNoopMove(move)) return { allowed: true };
			if (violatesAutoSort(move, (id) => current.autoSort(id) !== undefined))
				return { allowed: false, reason: current.messages.autoSorted };
			try {
				const verdict = current.canMove?.(move);
				if (verdict && !verdict.allowed)
					return {
						allowed: false,
						reason: verdict.reason ?? current.messages.moveRejected,
					};
			} catch {
				// 使用方的规则出错时按拒绝处理，拖拽本身不能因此中断
				return { allowed: false, reason: current.messages.moveRejected };
			}
			return { allowed: true };
		};

		/** @param force - 放下时强制按当前指针与布局重新求值 */
		const resolveTarget = (current: Runtime, force: boolean) => {
			const layout = measureColumns(root, live.current.options.autoSort, current.cardId);
			const target = resolveDropTarget(layout, current.pointer, {
				originColumnId: current.origin.columnId,
			});
			const key = target ? `${target.columnId}:${target.index}` : "";
			if (!force && key === current.targetKey) return;
			current.targetKey = key;
			let placeholder = current.origin;
			let invalid = false;
			let move: BoardMove | null = null;
			let reason: string | undefined;
			const created = target && createMove(state(), current.cardId, target);
			if (created) {
				const verdict = decide(created);
				if (verdict.allowed) {
					move = created;
					placeholder = created.to;
				} else {
					invalid = true;
					reason = verdict.reason;
				}
			}
			current.move = move;
			current.reason = reason;
			setSession((previous) =>
				previous?.phase === "dragging" &&
				(previous.placeholder.columnId !== placeholder.columnId ||
					previous.placeholder.index !== placeholder.index ||
					previous.invalid !== invalid)
					? { ...previous, placeholder, invalid }
					: previous,
			);
		};

		const startSettling = ({ cardId, origin, size }: Grabbed) =>
			setSession({ phase: "settling", cardId, origin, size });

		const endSettling = (cardId: string) => {
			if (run.current?.cardId === cardId) run.current = null;
			setSession((previous) =>
				previous?.phase === "settling" && previous.cardId === cardId ? null : previous,
			);
		};

		const commit = (move: BoardMove) => {
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
				endSettling(move.cardId);
				current.onMoveError?.(error, move);
				showNotice(current.messages.moveFailed);
			});
		};

		const host: DragHost = {
			root,
			cardIdFor(target) {
				const element = (target as Element | null)?.closest?.(CARD_SELECTOR);
				if (!element || !root.contains(element) || !element.hasAttribute("data-draggable"))
					return null;
				// 表单控件、可编辑文本与明确标记的元素有自己的指针语义，不起拖
				const own = (target as Element).closest(NO_DRAG_SELECTOR);
				if (own && element.contains(own)) return null;
				return element.getAttribute("data-card-id");
			},
			start(cardId, point) {
				const element = findCard(root, cardId);
				const origin = locateCard(state(), cardId);
				if (!element || !origin) return;
				const rect = element.getBoundingClientRect();
				const size = { width: rect.width, height: rect.height };
				run.current = {
					cardId,
					origin,
					size,
					pointer: point,
					grab: { x: point.x - rect.left, y: point.y - rect.top },
					ghostOffset: { x: 0, y: 0 },
					ghostReady: false,
					targetKey: "?",
					move: null,
					reason: undefined,
				};
				setSession({
					phase: "dragging",
					cardId,
					origin,
					placeholder: origin,
					invalid: false,
					size,
				});
			},
			move(point) {
				const current = run.current;
				if (!current) return;
				current.pointer = point;
				placeGhost(ghostRef.current, current);
				resolveTarget(current, false);
			},
			drop() {
				const current = run.current;
				if (!current) return;
				resolveTarget(current, true);
				if (current.move && !isNoopMove(current.move)) commit(current.move);
				else if (current.reason) showNotice(current.reason);
				startSettling(current);
			},
			cancel() {
				const current = run.current;
				if (current) startSettling(current);
			},
		};
		return controller.attach(host);
	}, [editable, controller, rootRef, showNotice]);

	// 浮起卡片挂载后：测出祖先 transform 造成的偏差并定位到指针
	useLayoutEffect(() => {
		const current = run.current;
		const ghost = ghostRef.current;
		if (session?.phase !== "dragging" || !current || !ghost || current.ghostReady) return;
		ghost.style.transform = "none";
		const rect = ghost.getBoundingClientRect();
		current.ghostOffset = { x: rect.left, y: rect.top };
		current.ghostReady = true;
		placeGhost(ghost, current);
	}, [session]);

	// 落位：浮起卡片平滑飞到卡片的最终位置，到达后卡片显现
	useLayoutEffect(() => {
		const root = rootRef.current;
		if (session?.phase !== "settling" || !root) return;
		const { cardId } = session;
		const current = run.current;
		const ghost = ghostRef.current;
		const finish = () => {
			if (run.current === current) run.current = null;
			setSession((previous) =>
				previous?.phase === "settling" && previous.cardId === cardId ? null : previous,
			);
		};
		const target = findCard(root, cardId)?.getBoundingClientRect();
		if (
			!current ||
			!ghost ||
			!target ||
			prefersReducedMotion() ||
			typeof ghost.animate !== "function"
		) {
			finish();
			return;
		}
		const animation = ghost.animate(
			[
				{ transform: ghost.style.transform || "none" },
				{
					transform: `translate(${target.left - current.ghostOffset.x}px, ${target.top - current.ghostOffset.y}px)`,
				},
			],
			{ duration: MOTION_MS, easing: MOTION_EASING, fill: "forwards" },
		);
		animation.finished.then(finish, () => {});
		return () => animation.cancel();
	}, [session, rootRef]);

	const flipKey = [
		JSON.stringify(columnIds.map((id) => [id, effectiveOrder[id] ?? []])),
		session?.phase,
		session?.cardId,
		session?.phase === "dragging"
			? `${session.placeholder.columnId}:${session.placeholder.index}`
			: "",
	].join("|");
	useFlip(scrollerRef, flipKey, editable);

	return {
		editable,
		order: effectiveOrder,
		dragging: session?.phase === "dragging" ? session : null,
		settlingId: session?.phase === "settling" ? session.cardId : null,
		ghost: session
			? { cardId: session.cardId, origin: session.origin, size: session.size }
			: null,
		ghostRef,
		notice,
	};
}
