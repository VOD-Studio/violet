import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
	type AutoSortEntry,
	type BoardMove,
	type BoardPosition,
	createMove,
	edgePanSpeed,
	isNoopMove,
	locateCard,
	type Point,
	type Rect,
	resolveDropTarget,
} from "../../core/index.ts";
import { EDITABLE_SELECTOR } from "../../editable.ts";
import { notifyEditing, PAN_REGION_SELECTOR, requestPan } from "../../pan-region.ts";
import type { ActivityRef } from "./activity.ts";
import { CARD_SELECTOR, findCard, measureColumns, screenScale, toRect } from "./dom.ts";
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

/** 被抓起的卡片：出发位置与抓起时的尺寸（布局像素，不含画布的缩放）。 */
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
	/** 抓取点相对卡片左上角的偏移（屏幕像素）。 */
	grab: Point;
	/**
	 * 这次拖拽已经放置过的浮起卡片节点。落位动画还没结束就抓起另一张卡时，
	 * 浮起卡片的节点会被复用，上面还留着上一张的平移，必须先重置再放置。
	 */
	ghost: HTMLElement | null;
	/** 浮起卡片当前的平移（布局像素）。 */
	ghostAt: Point;
	/** 看板所在的画布视口；不在画布里为 null。 */
	region: HTMLElement | null;
	/** 指针跟随与边缘平移共用的下一帧。 */
	frame: number | null;
	/** 上一帧的时间戳（ms）。 */
	frameAt: number;
	pointerChanged: boolean;
	/** 上次求值的落点，落点不变时不重复调用 `canMove`。 */
	targetKey: string;
	/** 当前落点对应的有效移动；没有落点或被拒绝时为 null。 */
	move: BoardMove | null;
	reason: string | undefined;
}

const defaultController = createPointerController();

const NO_DRAG_SELECTOR = `${EDITABLE_SELECTOR}, [data-kanban-no-drag]`;

const contains = (rect: Rect, point: Point) =>
	point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;

/**
 * 浮起卡片包含块原点的屏幕位置：当前矩形减去已经应用的平移。
 *
 * 看板在画布里时，fixed 定位相对被变换的祖先；每次放置前这样反推，画布平移或缩放之后仍然准确。
 */
function measureGhostOrigin(ghost: HTMLElement, scale: number, at: Point): Point {
	const box = ghost.getBoundingClientRect();
	return { x: box.left - scale * at.x, y: box.top - scale * at.y };
}

/** 把浮起卡片放到指针下，保持抓取位置。 */
function placeGhost(ghost: HTMLElement, run: Runtime, root: HTMLElement) {
	const scale = screenScale(root);
	const origin = measureGhostOrigin(ghost, scale, run.ghostAt);
	run.ghostAt = {
		x: (run.pointer.x - run.grab.x - origin.x) / scale,
		y: (run.pointer.y - run.grab.y - origin.y) / scale,
	};
	ghost.style.transform = `translate(${run.ghostAt.x}px, ${run.ghostAt.y}px)`;
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
			// 指针在画布视口之外时，列虽然在几何上还在那里，却是看不见的
			const visible =
				!current.region ||
				contains(toRect(current.region.getBoundingClientRect()), current.pointer);
			const layout = measureColumns(root, live.current.autoSort, current.cardId);
			const target = visible
				? resolveDropTarget(layout, current.pointer, {
						originColumnId: current.origin.columnId,
					})
				: null;
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

		/** 这次拖拽的浮起卡片已经挂载并放置过时，把它放到指针下。 */
		const followPointer = (current: Runtime) => {
			const ghost = ghostRef.current;
			if (ghost && current.ghost === ghost) placeGhost(ghost, current, root);
		};

		const stopPanning = (current: Runtime) => {
			if (current.frame !== null) cancelAnimationFrame(current.frame);
			current.frame = null;
		};

		const startSettling = (current: Runtime) => {
			stopPanning(current);
			setSession({
				phase: "settling",
				cardId: current.cardId,
				origin: current.origin,
				size: current.size,
			});
		};

		const tick = (current: Runtime, now: number) => {
			if (run.current !== current) return;
			current.frame = null;
			let changed = current.pointerChanged;
			current.pointerChanged = false;
			const seconds = Math.max(0, Math.min(now - current.frameAt, 64)) / 1000;
			current.frameAt = now;
			if (current.region) {
				const speed = edgePanSpeed(
					current.pointer,
					toRect(current.region.getBoundingClientRect()),
				);
				if (
					(speed.x !== 0 || speed.y !== 0) &&
					requestPan(root, speed.x * seconds, speed.y * seconds)
				)
					changed = true;
			}
			if (changed) {
				resolveTarget(current, false);
				followPointer(current);
			}
			if ((current.region || current.pointerChanged) && current.frame === null)
				current.frame = requestAnimationFrame((next) => tick(current, next));
		};

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
				const scale = screenScale(root);
				const size = { width: rect.width / scale, height: rect.height / scale };
				const region = root.closest<HTMLElement>(PAN_REGION_SELECTOR);
				live.current.activity.current = "pointer";
				const current: Runtime = {
					cardId,
					origin,
					size,
					pointer: point,
					grab: { x: point.x - rect.left, y: point.y - rect.top },
					ghost: null,
					ghostAt: { x: 0, y: 0 },
					region,
					frame: null,
					frameAt: performance.now(),
					pointerChanged: true,
					targetKey: "?",
					move: null,
					reason: undefined,
				};
				run.current = current;
				if (region) notifyEditing(root);
				current.frame = requestAnimationFrame((now) => tick(current, now));
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
				current.pointerChanged = true;
				if (current.frame === null)
					current.frame = requestAnimationFrame((now) => tick(current, now));
			},
			drop() {
				const current = run.current;
				if (!current) return;
				resolveTarget(current, true);
				followPointer(current);
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
		const detach = controller.attach(host);
		return () => {
			detach();
			if (run.current) stopPanning(run.current);
		};
	}, [editable, controller, rootRef, live, state, decide, commit, showNotice]);

	// 浮起卡片挂载后定位到指针
	useLayoutEffect(() => {
		const current = run.current;
		const ghost = ghostRef.current;
		const root = rootRef.current;
		if (session?.phase !== "dragging" || !current || !ghost || !root || current.ghost === ghost)
			return;
		ghost.style.transform = "";
		current.ghost = ghost;
		current.ghostAt = { x: 0, y: 0 };
		placeGhost(ghost, current, root);
	}, [session, rootRef]);

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
		const scale = screenScale(root);
		const origin = measureGhostOrigin(ghost, scale, current.ghostAt);
		const animation = ghost.animate(
			[
				{ transform: ghost.style.transform || "none" },
				{
					transform: `translate(${(target.left - origin.x) / scale}px, ${(target.top - origin.y) / scale}px)`,
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
