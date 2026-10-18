import type { Point } from "../../core/index.ts";
import type { DragController, DragHost } from "./types.ts";

/** 默认指针控制器的参数。 */
export interface PointerControllerOptions {
	/**
	 * 鼠标与笔移动超过多少 px 才开始拖拽，之前仍是点击。
	 * @default 4
	 */
	threshold?: number;
	/**
	 * 触屏需要按住多久才开始拖拽（ms）；更早的移动视为页面滚动。
	 * @default 250
	 */
	touchHoldDelay?: number;
	/**
	 * 触屏在长按期间允许的手指漂移（px），超过即放弃拖拽。
	 * @default 8
	 */
	touchTolerance?: number;
}

/**
 * 默认的指针拖拽控制器：鼠标、笔与触屏共用 Pointer Events。
 *
 * 鼠标与笔移动超过阈值开始拖拽；触屏长按开始，避免抢走页面滚动。拖拽后抑制随之而来的点击，
 * Esc、窗口失焦与 pointercancel 取消拖拽。
 */
export function createPointerController(options: PointerControllerOptions = {}): DragController {
	const { threshold = 4, touchHoldDelay = 250, touchTolerance = 8 } = options;

	return {
		attach(host: DragHost) {
			const { root } = host;
			let candidate: {
				cardId: string;
				pointerId: number;
				pointerType: string;
				origin: Point;
				last: Point;
				timer?: ReturnType<typeof setTimeout>;
			} | null = null;
			let dragging = false;

			const point = (event: PointerEvent): Point => ({ x: event.clientX, y: event.clientY });
			const prevent = (event: Event) => event.preventDefault();
			// 浏览器在触摸开始时就决定手势能否被取消，所以非被动监听要常驻；只在拖拽中才阻止滚动。
			// 挂在看板根上而不是 window：只有从看板内开始的触摸才会因它等待主线程。
			const preventTouchScroll = (event: Event) => {
				if (dragging && event.cancelable) event.preventDefault();
			};
			const cancelOnEscape = (event: KeyboardEvent) => {
				if (event.key !== "Escape") return;
				event.preventDefault();
				event.stopPropagation();
				finish("cancel", false);
			};
			const swallowClick = (event: Event) => {
				event.preventDefault();
				event.stopPropagation();
			};

			const toggle = (
				active: boolean,
				target: EventTarget,
				type: string,
				handler: (event: never) => void,
				capture: boolean | AddEventListenerOptions = false,
			) => {
				const listener = handler as EventListener;
				if (active) target.addEventListener(type, listener, capture);
				else target.removeEventListener(type, listener, capture);
			};
			const listen = (active: boolean) => {
				toggle(active, document, "pointermove", onMove);
				toggle(active, document, "pointerup", onUp);
				toggle(active, document, "pointercancel", onCancel);
				toggle(active, document, "dragstart", prevent, true);
				toggle(active, document, "selectstart", prevent, true);
				toggle(active, window, "blur", onBlur);
			};
			const listenWhileDragging = (active: boolean, touch: boolean) => {
				toggle(active, document, "keydown", cancelOnEscape, true);
				if (touch) toggle(active, document, "contextmenu", prevent, true);
			};

			/**
			 * 拦截拖拽结束后随之而来的 click。
			 * 指针仍按着时（Esc、失焦取消），click 要等松开才会补发，所以保持到下一次抬起或按下。
			 */
			function suppressClick(pointerReleased: boolean) {
				root.addEventListener("click", swallowClick, true);
				const disarm = () => {
					for (const type of ["pointerup", "pointercancel", "pointerdown"])
						document.removeEventListener(type, disarm, true);
					setTimeout(() => root.removeEventListener("click", swallowClick, true), 0);
				};
				if (pointerReleased) {
					disarm();
					return;
				}
				for (const type of ["pointerup", "pointercancel", "pointerdown"])
					document.addEventListener(type, disarm, true);
			}

			function begin() {
				if (!candidate) return;
				clearTimeout(candidate.timer);
				dragging = true;
				try {
					root.setPointerCapture?.(candidate.pointerId);
				} catch {
					// 指针已失效时捕获会抛错，拖拽仍可靠 document 监听继续
				}
				listenWhileDragging(true, candidate.pointerType === "touch");
				host.start(candidate.cardId, candidate.origin);
				host.move(candidate.last);
			}

			function finish(outcome: "drop" | "cancel", pointerReleased: boolean) {
				if (!candidate) return;
				const wasDragging = dragging;
				const { pointerId, pointerType, timer } = candidate;
				clearTimeout(timer);
				candidate = null;
				dragging = false;
				listen(false);
				if (!wasDragging) return;
				listenWhileDragging(false, pointerType === "touch");
				try {
					root.releasePointerCapture?.(pointerId);
				} catch {
					// 捕获可能已随指针结束而释放
				}
				if (outcome === "drop") host.drop();
				else host.cancel();
				suppressClick(pointerReleased);
			}

			function onMove(event: PointerEvent) {
				if (!candidate || event.pointerId !== candidate.pointerId) return;
				candidate.last = point(event);
				if (dragging) {
					host.move(candidate.last);
					return;
				}
				const distance = Math.hypot(
					candidate.last.x - candidate.origin.x,
					candidate.last.y - candidate.origin.y,
				);
				if (candidate.pointerType === "touch") {
					if (distance > touchTolerance) finish("cancel", false);
				} else if (distance > threshold) begin();
			}

			function onUp(event: PointerEvent) {
				if (candidate && event.pointerId === candidate.pointerId) finish("drop", true);
			}

			function onCancel(event: PointerEvent) {
				if (candidate && event.pointerId === candidate.pointerId) finish("cancel", true);
			}

			function onBlur() {
				finish("cancel", false);
			}

			function onDown(event: PointerEvent) {
				if (candidate || !event.isPrimary) return;
				if (event.pointerType !== "touch" && event.button !== 0) return;
				const cardId = host.cardIdFor(event.target);
				if (!cardId) return;
				candidate = {
					cardId,
					pointerId: event.pointerId,
					pointerType: event.pointerType,
					origin: point(event),
					last: point(event),
				};
				listen(true);
				if (event.pointerType === "touch")
					candidate.timer = setTimeout(begin, touchHoldDelay);
			}

			root.addEventListener("pointerdown", onDown);
			root.addEventListener("touchmove", preventTouchScroll, { passive: false });
			return () => {
				root.removeEventListener("pointerdown", onDown);
				root.removeEventListener("touchmove", preventTouchScroll);
				if (candidate) finish("cancel", false);
			};
		},
	};
}
