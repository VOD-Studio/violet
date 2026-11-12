/** 原生滚动容器某一时刻的位置与尺寸，单位为 CSS px。 */
export interface ScrollMetrics {
	scrollTop: number;
	scrollLeft: number;
	scrollHeight: number;
	scrollWidth: number;
	clientHeight: number;
	clientWidth: number;
}

/** 允许滚动的方向。 */
export type ScrollOrientation = "vertical" | "horizontal" | "both";

/** 某一侧是否还有未显示的内容。 */
export interface ScrollEdges {
	top: boolean;
	bottom: boolean;
	left: boolean;
	right: boolean;
}

export type ScrollEdge = keyof ScrollEdges;

/** 服务端与首帧没有布局信息，按“没有溢出”渲染，挂载后再测量。 */
export const EMPTY_SCROLL_METRICS: ScrollMetrics = {
	scrollTop: 0,
	scrollLeft: 0,
	scrollHeight: 0,
	scrollWidth: 0,
	clientHeight: 0,
	clientWidth: 0,
};

/** 缩放与子像素滚动会留下不足 1px 的余量，不算还有内容。 */
const EDGE_TOLERANCE = 1;

export function readScrollMetrics(element: HTMLElement): ScrollMetrics {
	return {
		scrollTop: element.scrollTop,
		scrollLeft: element.scrollLeft,
		scrollHeight: element.scrollHeight,
		scrollWidth: element.scrollWidth,
		clientHeight: element.clientHeight,
		clientWidth: element.clientWidth,
	};
}

export function isSameScrollMetrics(a: ScrollMetrics, b: ScrollMetrics): boolean {
	return (
		a.scrollTop === b.scrollTop &&
		a.scrollLeft === b.scrollLeft &&
		a.scrollHeight === b.scrollHeight &&
		a.scrollWidth === b.scrollWidth &&
		a.clientHeight === b.clientHeight &&
		a.clientWidth === b.clientWidth
	);
}

/** 内容是否比视口长，需要滚动条。 */
export function hasOverflow(viewportSize: number, contentSize: number): boolean {
	return contentSize - viewportSize > EDGE_TOLERANCE;
}

/** 按当前位置判断四侧是否还有内容；不允许滚动的方向一律视为没有。 */
export function scrollEdges(metrics: ScrollMetrics, orientation: ScrollOrientation): ScrollEdges {
	const vertical = orientation !== "horizontal";
	const horizontal = orientation !== "vertical";
	const maxTop = metrics.scrollHeight - metrics.clientHeight;
	const maxLeft = metrics.scrollWidth - metrics.clientWidth;

	return {
		top: vertical && metrics.scrollTop > EDGE_TOLERANCE,
		bottom: vertical && metrics.scrollTop < maxTop - EDGE_TOLERANCE,
		left: horizontal && metrics.scrollLeft > EDGE_TOLERANCE,
		right: horizontal && metrics.scrollLeft < maxLeft - EDGE_TOLERANCE,
	};
}
