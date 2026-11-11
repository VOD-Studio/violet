import { type CSSProperties, type PointerEvent, type RefObject, useRef } from "react";
import { hasOverflow, type ScrollMetrics } from "./scroll-metrics";

interface ScrollbarProps {
	axis: "vertical" | "horizontal";
	metrics: ScrollMetrics;
	viewport: RefObject<HTMLElement | null>;
}

/** 按下滑块时记下的起点。 */
interface DragOrigin {
	pointerId: number;
	pointer: number;
	scroll: number;
	/** 滑块每移动 1px 对应的滚动距离：滚动范围 ÷ 滑块可移动的距离。 */
	scrollPerPixel: number;
}

/**
 * 单个方向的覆盖式滑块，拖动时直接改写原生滚动位置。
 *
 * @remarks 对读屏隐藏：键盘与读屏用户通过视口本身滚动。
 */
export function Scrollbar({ axis, metrics, viewport }: ScrollbarProps) {
	const drag = useRef<DragOrigin | null>(null);
	const vertical = axis === "vertical";
	const viewportSize = vertical ? metrics.clientHeight : metrics.clientWidth;
	const contentSize = vertical ? metrics.scrollHeight : metrics.scrollWidth;
	const offset = vertical ? metrics.scrollTop : metrics.scrollLeft;

	if (!hasOverflow(viewportSize, contentSize)) return null;

	// 长度与位置交给 CSS 按轨道换算，这里只给比例，不读取轨道尺寸。
	const thumbStyle = {
		"--v-scrollbar-ratio": viewportSize / contentSize,
		"--v-scrollbar-progress": Math.min(1, Math.max(0, offset / (contentSize - viewportSize))),
	} as CSSProperties;

	const startDrag = (event: PointerEvent<HTMLDivElement>) => {
		const element = viewport.current;
		const track = event.currentTarget.parentElement;
		if (event.button !== 0 || !element || !track) return;

		// 阻止拖动时选中页面文字。
		event.preventDefault();

		const trackBox = track.getBoundingClientRect();
		const thumbBox = event.currentTarget.getBoundingClientRect();
		const travel = vertical
			? trackBox.height - thumbBox.height
			: trackBox.width - thumbBox.width;
		const range = vertical
			? element.scrollHeight - element.clientHeight
			: element.scrollWidth - element.clientWidth;

		drag.current = {
			pointerId: event.pointerId,
			pointer: vertical ? event.clientY : event.clientX,
			scroll: vertical ? element.scrollTop : element.scrollLeft,
			scrollPerPixel: travel > 0 ? range / travel : 0,
		};
		event.currentTarget.setPointerCapture(event.pointerId);
	};

	const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
		const origin = drag.current;
		const element = viewport.current;
		if (!origin || origin.pointerId !== event.pointerId || !element) return;

		const pointer = vertical ? event.clientY : event.clientX;
		const scroll = origin.scroll + (pointer - origin.pointer) * origin.scrollPerPixel;

		if (vertical) element.scrollTop = scroll;
		else element.scrollLeft = scroll;
	};

	const endDrag = (event: PointerEvent<HTMLDivElement>) => {
		if (drag.current?.pointerId === event.pointerId) drag.current = null;
	};

	return (
		<div className="v-scrollbar" data-axis={axis} aria-hidden="true">
			<div
				className="v-scrollbar__thumb"
				style={thumbStyle}
				onPointerDown={startDrag}
				onPointerMove={moveDrag}
				onPointerUp={endDrag}
				onPointerCancel={endDrag}
				onLostPointerCapture={endDrag}
			/>
		</div>
	);
}
