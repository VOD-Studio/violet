import { type RefObject, useCallback, useEffect, useRef } from "react";

/** 高度档：随内容一档；或半屏与全屏两档。 */
export type DrawerSnapPoints = "content" | "half-full";

/** 停在哪一档；随内容的抽屉只有 full。 */
export type DrawerDetent = "half" | "full";

/** 快速滑动的门槛，超过即按方向切档或关闭。 */
const FLING_PX_PER_MS = 0.5;
/** 往下拖超过可见高度的这个比例就关闭。 */
const CLOSE_RATIO = 0.25;
/** 半屏占窗口高度的比例。 */
const HALF_RATIO = 0.52;
/** 全屏时顶部露出的高度，看得到状态栏。 */
const TOP_GAP = 48;
/** 判定拖动方向前允许的抖动。 */
const SLOP_PX = 4;
/** 计算速度时只看最近这段时间的位移。 */
const VELOCITY_WINDOW_MS = 100;

interface Sample {
	y: number;
	time: number;
}

interface DragState {
	pointerId: number | null;
	startY: number;
	startOffset: number;
	samples: Sample[];
	/** 从内容区开始的按下，要等方向确定后才决定是不是拖面板 */
	fromBody: boolean;
	active: boolean;
}

export interface DrawerDragOptions {
	/** 已挂载的面板；Portal 晚一拍挂载，跟随元素本身而不是 ref */
	panel: HTMLElement | null;
	overlayRef: RefObject<HTMLElement | null>;
	snapPoints: DrawerSnapPoints;
	detent: DrawerDetent;
	onDetentChange: (detent: DrawerDetent) => void;
	onClose: () => void;
}

/** 越过最高处时越拖越慢。 */
function resist(offset: number) {
	return offset < 0 ? -Math.sqrt(-offset) * 4 : offset;
}

function velocity(samples: Sample[]) {
	const last = samples.at(-1);
	if (!last) return 0;
	const first = samples.find((sample) => last.time - sample.time <= VELOCITY_WINDOW_MS) ?? last;
	const elapsed = last.time - first.time;
	return elapsed > 0 ? (last.y - first.y) / elapsed : 0;
}

/**
 * 抽屉的拖动：跟手不加延迟，松手按位置和速度一起判断去哪一档。
 *
 * @returns 绑在把手、标题区与内容区上的按下处理，以及按档位计算的位移
 */
export function useDrawerDrag({
	panel,
	overlayRef,
	snapPoints,
	detent,
	onDetentChange,
	onClose,
}: DrawerDragOptions) {
	const state = useRef<DragState>({
		pointerId: null,
		startY: 0,
		startOffset: 0,
		samples: [],
		fromBody: false,
		active: false,
	});

	/** 半屏档相对全屏档往下的位移；全屏档为 0。 */
	const halfOffset = useCallback(() => {
		if (!panel || snapPoints !== "half-full") return 0;
		const full = panel.offsetHeight;
		const viewport = full + TOP_GAP;
		return Math.max(0, full - viewport * HALF_RATIO);
	}, [panel, snapPoints]);

	const offsetFor = useCallback(
		(target: DrawerDetent) => (target === "half" ? halfOffset() : 0),
		[halfOffset],
	);

	const apply = useCallback(
		(offset: number, dragging: boolean) => {
			if (!panel) return;
			panel.style.setProperty("--v-drawer-offset", `${offset}px`);
			if (dragging) panel.dataset.dragging = "";
			else delete panel.dataset.dragging;
			const overlay = overlayRef.current;
			if (!overlay) return;
			// 遮罩随拖动距离线性变淡
			const visible = panel.offsetHeight - offsetFor(detent);
			const progress = visible > 0 ? Math.max(0, offset - offsetFor(detent)) / visible : 0;
			overlay.style.opacity = dragging ? String(Math.max(0, 1 - progress)) : "";
		},
		[panel, overlayRef, offsetFor, detent],
	);

	// 换档或窗口变化后回到当前档的位置
	useEffect(() => {
		apply(offsetFor(detent), false);
		const onResize = () => apply(offsetFor(detent), false);
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, [apply, offsetFor, detent]);

	const release = useCallback(() => {
		const drag = state.current;
		if (!drag.active || !panel) {
			drag.pointerId = null;
			return;
		}
		drag.active = false;
		drag.pointerId = null;
		const current = Number.parseFloat(panel.style.getPropertyValue("--v-drawer-offset")) || 0;
		const speed = velocity(drag.samples);
		const base = offsetFor(detent);
		const visible = panel.offsetHeight - base;
		let next: DrawerDetent | "closed";
		if (speed > FLING_PX_PER_MS)
			next = detent === "full" && snapPoints === "half-full" ? "half" : "closed";
		else if (speed < -FLING_PX_PER_MS) next = "full";
		else if (current - base > visible * CLOSE_RATIO) next = "closed";
		else if (snapPoints === "half-full") next = current < halfOffset() / 2 ? "full" : "half";
		else next = "full";
		if (next === "closed") {
			// 保留当前位移，退场动画从手指松开的位置落回底边
			delete panel.dataset.dragging;
			onClose();
			return;
		}
		apply(offsetFor(next), false);
		if (next !== detent) onDetentChange(next);
	}, [panel, offsetFor, detent, snapPoints, halfOffset, apply, onClose, onDetentChange]);

	const move = useCallback(
		(y: number, time: number, cancel: () => void) => {
			const drag = state.current;
			const dy = y - drag.startY;
			if (!drag.active) {
				const body = panel?.querySelector<HTMLElement>("[data-slot='drawer-body']");
				const scrollable =
					detent === "full" && body && body.scrollHeight > body.clientHeight;
				// 内容区还能滚时把手势交给滚动：往上拖、或者没滚到顶
				if (drag.fromBody && scrollable && (dy <= 0 || (body?.scrollTop ?? 0) > 0)) {
					if (Math.abs(dy) >= SLOP_PX) drag.pointerId = null;
					return;
				}
				// 先拦下原生滚动，手势才归面板
				cancel();
				if (Math.abs(dy) < SLOP_PX) return;
				drag.active = true;
			}
			cancel();
			drag.samples.push({ y, time });
			if (drag.samples.length > 8) drag.samples.shift();
			apply(resist(drag.startOffset + dy), true);
		},
		[panel, detent, apply],
	);

	const start = useCallback(
		(y: number, time: number, fromBody: boolean, pointerId: number) => {
			state.current = {
				pointerId,
				startY: y,
				startOffset: offsetFor(detent),
				samples: [{ y, time }],
				fromBody,
				active: false,
			};
		},
		[offsetFor, detent],
	);

	useEffect(() => {
		const onPointerMove = (event: PointerEvent) => {
			if (event.pointerId !== state.current.pointerId || event.pointerType === "touch")
				return;
			move(event.clientY, event.timeStamp, () => event.preventDefault());
		};
		const onPointerUp = (event: PointerEvent) => {
			if (event.pointerId === state.current.pointerId) release();
		};
		// 触屏用 touch 事件：内容区滚到顶再往下拖时要拦下原生滚动，pointer 事件做不到
		const onTouchMove = (event: TouchEvent) => {
			const touch = event.touches[0];
			if (state.current.pointerId === null || !touch) return;
			move(touch.clientY, event.timeStamp, () => event.preventDefault());
		};
		const onTouchEnd = () => {
			if (state.current.pointerId !== null) release();
		};
		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerUp);
		window.addEventListener("touchmove", onTouchMove, { passive: false });
		window.addEventListener("touchend", onTouchEnd);
		window.addEventListener("touchcancel", onTouchEnd);
		return () => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerUp);
			window.removeEventListener("touchmove", onTouchMove);
			window.removeEventListener("touchend", onTouchEnd);
			window.removeEventListener("touchcancel", onTouchEnd);
		};
	}, [move, release]);

	/** 绑在把手与标题区：按下就开始拖。 */
	const onHandlePointerDown = useCallback(
		(event: React.PointerEvent) => {
			if (event.button !== 0 || (event.target as Element).closest("button, a, input")) return;
			start(event.clientY, event.timeStamp, false, event.pointerId);
		},
		[start],
	);

	/** 绑在内容区：滚到顶再往下拖，或半屏时上下拖，才带动面板。 */
	const onBodyPointerDown = useCallback(
		(event: React.PointerEvent) => {
			if (event.button !== 0 || (event.target as Element).closest("input, textarea, select"))
				return;
			start(event.clientY, event.timeStamp, true, event.pointerId);
		},
		[start],
	);

	return { onHandlePointerDown, onBodyPointerDown, offsetFor };
}
