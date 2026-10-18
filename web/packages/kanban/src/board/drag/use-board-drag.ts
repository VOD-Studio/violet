import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
	type AutoSortEntry,
	type BoardMove,
	type BoardPosition,
	createMove,
	isNoopMove,
	locateCard,
	type Point,
	resolveDropTarget,
} from "../../core/index.ts";
import type { ActivityRef } from "./activity.ts";
import { CARD_SELECTOR, findCard, measureColumns } from "./dom.ts";
import { MOTION_EASING, MOTION_MS, prefersReducedMotion } from "./motion.ts";
import { createPointerController } from "./pointer-controller.ts";
import type { DragController, DragHost } from "./types.ts";
import type { BoardMoves } from "./use-board-moves.ts";
import { useLatest } from "./use-latest.ts";

/** `useBoardDrag` 的输入：DOM 引用与共用的移动逻辑。 */
export interface BoardDragOptions {
	rootRef: RefObject<HTMLElement | null>;
	moves: BoardMoves;
	autoSort: (columnId: string) => AutoSortEntry | undefined;
	controller?: DragController;
	/** 同一时刻只有一种输入占用看板：键盘拿着卡片时不接受指针拖拽。 */
	activity: ActivityRef;
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
	dragging: DragView | null;
	/** 正在落位的卡片，其位置已确定但要等浮起卡片飞到才显现。 */
	settlingId: string | null;
	/** 浮起卡片：拖拽与落位期间存在。 */
	ghost: Grabbed | null;
	ghostRef: RefObject<HTMLDivElement | null>;
	/** 会引起其余卡片位置变化的拖拽状态指纹，供位移过渡使用。 */
	layoutKey: string;
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

function placeGhost(ghost: HTMLElement | null, run: Runtime) {
	if (!ghost || !run.ghostReady) return;
	const x = run.pointer.x - run.grab.x - run.ghostOffset.x;
	const y = run.pointer.y - run.grab.y - run.ghostOffset.y;
	ghost.style.transform = `translate(${x}px, ${y}px)`;
}

/**
 * 指针拖拽编排：把控制器的拖拽指令变成落点、占位、浮起卡片与移动事件。
 */
export function useBoardDrag(options: BoardDragOptions): BoardDrag {
	const { rootRef, moves, controller = defaultController } = options;
	const { editable, state, decide, commit, showNotice } = moves;

	const [session, setSession] = useState<Session | null>(null);
	const live = useLatest(options);
	const run = useRef<Runtime | null>(null);
	const ghostRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const root = rootRef.current;
		if (!root || !editable) return;

		/** @param force - 放下时强制按当前指针与布局重新求值 */
		const resolveTarget = (current: Runtime, force: boolean) => {
			const layout = measureColumns(root, live.current.autoSort, current.cardId);
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

		const release = (current: Runtime | null) => {
			if (run.current !== current) return;
			run.current = null;
			live.current.activity.current = null;
		};

		const endSettling = (cardId: string) => {
			if (run.current?.cardId === cardId) release(run.current);
			setSession((previous) =>
				previous?.phase === "settling" && previous.cardId === cardId ? null : previous,
			);
		};

		const host: DragHost = {
			root,
			cardIdFor(target) {
				if (live.current.activity.current === "keyboard") return null;
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
				live.current.activity.current = "pointer";
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
				if (current.move && !isNoopMove(current.move))
					commit(current.move, () => endSettling(current.cardId));
				else if (current.reason) showNotice(current.reason);
				startSettling(current);
			},
			cancel() {
				const current = run.current;
				if (current) startSettling(current);
			},
		};
		return controller.attach(host);
	}, [editable, controller, rootRef, live, state, decide, commit, showNotice]);

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
			if (run.current === current) {
				run.current = null;
				live.current.activity.current = null;
			}
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
	}, [session, rootRef, live]);

	return {
		dragging: session?.phase === "dragging" ? session : null,
		settlingId: session?.phase === "settling" ? session.cardId : null,
		ghost: session
			? { cardId: session.cardId, origin: session.origin, size: session.size }
			: null,
		ghostRef,
		layoutKey: [
			session?.phase,
			session?.cardId,
			session?.phase === "dragging"
				? `${session.placeholder.columnId}:${session.placeholder.index}`
				: "",
		].join(":"),
	};
}
