import { type RefObject, useEffect, useRef } from "react";
import {
	type Point,
	panBy,
	pinchViewport,
	type ScaleLimits,
	type Viewport,
	zoomAt,
	zoomByFactor,
} from "../core/index.ts";
import { EDITABLE_SELECTOR } from "../editable.ts";
import { HOLD_PENDING_ATTRIBUTE } from "../pan-region.ts";

/** 在这些元素上按下不平移：它们有自己的指针语义（输入）。 */
const NO_PAN_SELECTOR = `${EDITABLE_SELECTOR}, [data-kanban-no-pan]`;

/** 可拖的卡片：鼠标按下是为了拖卡片，触屏要长按才拖，更早的移动属于画布。 */
const DRAGGABLE_SELECTOR = '[data-draggable="true"]';

/** 鼠标在按钮与链接上按下是为了点击；触屏没有别的滚动手段，从它们上面起手也要能平移。 */
const NO_MOUSE_PAN_SELECTOR = `${DRAGGABLE_SELECTOR}, a, button`;

/** 移动超过多少 px 才算平移，之前仍是点击。 */
const PAN_THRESHOLD = 3;

/** 看板在等触屏长按：这根手指还没判定是拖卡片还是滑动，画布先不动。 */
const HOLD_PENDING_SELECTOR = `[${HOLD_PENDING_ATTRIBUTE}]`;

/** 看板拖拽进行中的标记。 */
const DRAGGING_SELECTOR = '[data-dragging="true"]';

/** 滚轮缩放的灵敏度：每滚动 1 个 delta 单位的指数系数。 */
const WHEEL_SENSITIVITY = 0.002;

/** Safari 的触控板捏合事件；`scale` 是相对手势开始时的倍数。 */
interface GestureEventLike extends Event {
	scale: number;
	clientX: number;
	clientY: number;
}

export interface CanvasGestureOptions {
	/** 平移与双指手势发生的视口元素，手势坐标以它的左上角为原点。 */
	element: RefObject<HTMLElement | null>;
	/** 接收 Ctrl/⌘ 滚轮与触控板捏合的范围；包含控件条，这些位置上的缩放手势同样不该缩放整个页面。 */
	scope: RefObject<HTMLElement | null>;
	/** 读取当前视口；手势里连续多次更新，必须读到最新值。 */
	getViewport(): Viewport;
	/** 应用一次由用户手势产生的视口变化，不做过渡。 */
	setViewport(next: Viewport): void;
	limits: ScaleLimits;
}

/**
 * 画布的指针手势：Ctrl/⌘ 加滚轮与触控板捏合缩放（普通滚轮不拦截）、拖动背景平移、触屏双指缩放与平移。
 *
 * 用原生监听：React 的 wheel 是被动监听，无法阻止浏览器自己的页面缩放。
 */
export function useCanvasGestures(options: CanvasGestureOptions) {
	const { element, scope, limits } = options;
	const live = useRef(options);
	live.current = options;

	// biome-ignore lint/correctness/useExhaustiveDependencies: 手势里读写视口一律经 live，不随渲染重建监听
	useEffect(() => {
		const target = element.current;
		const root = scope.current ?? target;
		if (!target || !root) return;

		/** 手势进行中缓存视口位置，免得每次移动都在样式写入之后强制布局。 */
		let box: DOMRect | null = null;
		const local = (event: { clientX: number; clientY: number }): Point => {
			const rect = box ?? target.getBoundingClientRect();
			return { x: event.clientX - rect.left, y: event.clientY - rect.top };
		};

		const onWheel = (event: WheelEvent) => {
			if (!event.ctrlKey && !event.metaKey) return;
			event.preventDefault();
			const lines = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
			const factor = Math.exp(-event.deltaY * lines * WHEEL_SENSITIVITY);
			const { getViewport, setViewport } = live.current;
			setViewport(zoomByFactor(getViewport(), local(event), factor, limits));
		};

		const pointers = new Map<number, Point>();
		let pan: {
			id: number;
			start: Point;
			origin: Viewport;
			active: boolean;
			/** 起手在可拖卡片上：看板一旦开始拖拽，这根手指就归看板。 */
			yieldsToDrag: boolean;
		} | null = null;
		let pinch: { ids: [number, number]; from: [Point, Point]; origin: Viewport } | null = null;

		const setPanning = (active: boolean) => {
			if (active) target.setAttribute("data-panning", "true");
			else target.removeAttribute("data-panning");
		};

		const onPointerDown = (event: PointerEvent) => {
			if (event.pointerType === "mouse" && event.button !== 0) return;
			const source = event.target as Element | null;
			if (source?.closest?.(NO_PAN_SELECTOR)) return;
			const touch = event.pointerType === "touch";
			if (!touch && source?.closest?.(NO_MOUSE_PAN_SELECTOR)) return;
			const onCard = Boolean(source?.closest?.(DRAGGABLE_SELECTOR));
			// 看板正在拖卡片：新落下的手指属于看板这次拖拽，画布不开始任何手势
			if (target.querySelector(DRAGGING_SELECTOR)) return;
			if (pointers.size === 0) box = target.getBoundingClientRect();
			const point = local(event);
			pointers.set(event.pointerId, point);
			if (pointers.size === 1) {
				pan = {
					id: event.pointerId,
					start: point,
					origin: live.current.getViewport(),
					active: false,
					yieldsToDrag: onCard,
				};
			} else if (pointers.size === 2) {
				const [first, second] = [...pointers.entries()];
				pan = null;
				pinch = {
					ids: [first[0], second[0]],
					from: [first[1], second[1]],
					origin: live.current.getViewport(),
				};
				setPanning(true);
			}
		};

		const onPointerMove = (event: PointerEvent) => {
			if (!pointers.has(event.pointerId)) return;
			const point = local(event);
			pointers.set(event.pointerId, point);
			if (pinch) {
				const [a, b] = pinch.ids;
				const first = pointers.get(a);
				const second = pointers.get(b);
				if (first && second)
					live.current.setViewport(
						pinchViewport(pinch.origin, pinch.from, [first, second], limits),
					);
				return;
			}
			if (!pan || pan.id !== event.pointerId) return;
			if (pan.yieldsToDrag && target.querySelector(DRAGGING_SELECTOR)) {
				pointers.delete(event.pointerId);
				pan = null;
				setPanning(false);
				if (pointers.size === 0) box = null;
				return;
			}
			const dx = point.x - pan.start.x;
			const dy = point.y - pan.start.y;
			if (!pan.active && Math.hypot(dx, dy) <= PAN_THRESHOLD) return;
			if (pan.yieldsToDrag && target.querySelector(HOLD_PENDING_SELECTOR)) return;
			if (!pan.active) {
				pan.active = true;
				setPanning(true);
				try {
					target.setPointerCapture?.(event.pointerId);
				} catch {
					// 指针已失效时捕获会抛错，平移仍可继续
				}
			}
			live.current.setViewport(panBy(pan.origin, dx, dy));
		};

		const onPointerEnd = (event: PointerEvent) => {
			if (!pointers.delete(event.pointerId)) return;
			if (pinch?.ids.includes(event.pointerId)) pinch = null;
			if (pan?.id === event.pointerId) pan = null;
			// 双指之一抬起后剩下的那根不继续平移，要重新按下
			if (pointers.size === 0 || (!pan && !pinch)) setPanning(false);
			if (pointers.size === 0) box = null;
		};

		// Safari 的触控板捏合不发指针事件，也不发带 ctrlKey 的滚轮；触屏的捏合已由上面的指针事件处理
		let gesture: Viewport | null = null;
		const onGestureStart = (event: Event) => {
			event.preventDefault();
			gesture = pointers.size === 0 ? live.current.getViewport() : null;
		};
		const onGestureChange = (event: Event) => {
			event.preventDefault();
			if (!gesture) return;
			const { scale, clientX, clientY } = event as GestureEventLike;
			live.current.setViewport(
				zoomAt(gesture, local({ clientX, clientY }), gesture.scale * scale, limits),
			);
		};
		const onGestureEnd = (event: Event) => {
			event.preventDefault();
			gesture = null;
		};

		root.addEventListener("wheel", onWheel, { passive: false });
		root.addEventListener("gesturestart", onGestureStart);
		root.addEventListener("gesturechange", onGestureChange);
		root.addEventListener("gestureend", onGestureEnd);
		target.addEventListener("pointerdown", onPointerDown);
		target.addEventListener("pointermove", onPointerMove);
		target.addEventListener("pointerup", onPointerEnd);
		target.addEventListener("pointercancel", onPointerEnd);
		return () => {
			root.removeEventListener("wheel", onWheel);
			root.removeEventListener("gesturestart", onGestureStart);
			root.removeEventListener("gesturechange", onGestureChange);
			root.removeEventListener("gestureend", onGestureEnd);
			target.removeEventListener("pointerdown", onPointerDown);
			target.removeEventListener("pointermove", onPointerMove);
			target.removeEventListener("pointerup", onPointerEnd);
			target.removeEventListener("pointercancel", onPointerEnd);
			setPanning(false);
		};
	}, [element, scope, limits.min, limits.max]);
}
