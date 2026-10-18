import type { Point, Rect } from "./moves.ts";

/**
 * 画布视口：内容点 p 显示在容器坐标 `p * scale + (x, y)`。
 * 容器坐标以容器左上角为原点，单位是屏幕像素。
 */
export interface Viewport {
	scale: number;
	x: number;
	y: number;
}

export interface Size {
	width: number;
	height: number;
}

/** 缩放范围。 */
export interface ScaleLimits {
	min: number;
	max: number;
}

export const DEFAULT_SCALE_LIMITS: ScaleLimits = { min: 0.3, max: 2 };

export const IDENTITY_VIEWPORT: Viewport = { scale: 1, x: 0, y: 0 };

/** 把缩放收敛到范围内；非有限数视为 1（再收敛到范围内）。 */
export const clampScale = (scale: number, limits: ScaleLimits) =>
	Math.min(limits.max, Math.max(limits.min, Number.isFinite(scale) ? scale : 1));

/** 校正外部给出的视口：缩放收敛到范围内，非有限的平移视为 0。 */
export const normalizeViewport = (viewport: Viewport, limits: ScaleLimits): Viewport => ({
	scale: clampScale(viewport.scale, limits),
	x: Number.isFinite(viewport.x) ? viewport.x : 0,
	y: Number.isFinite(viewport.y) ? viewport.y : 0,
});

/** 缩放到 `scale`，锚点（容器坐标）下的内容点保持不动。 */
export function zoomAt(
	viewport: Viewport,
	anchor: Point,
	scale: number,
	limits: ScaleLimits,
): Viewport {
	const next = clampScale(scale, limits);
	const contentX = (anchor.x - viewport.x) / viewport.scale;
	const contentY = (anchor.y - viewport.y) / viewport.scale;
	return { scale: next, x: anchor.x - contentX * next, y: anchor.y - contentY * next };
}

/** 在当前缩放上乘以系数，其余同 {@link zoomAt}。 */
export const zoomByFactor = (
	viewport: Viewport,
	anchor: Point,
	factor: number,
	limits: ScaleLimits,
) => zoomAt(viewport, anchor, viewport.scale * factor, limits);

/**
 * 按钮与键盘的缩放步进。
 *
 * @param direction - 1 放大，-1 缩小
 * @param ratio - 每步的倍数
 * @default ratio 1.25
 */
export const stepScale = (scale: number, direction: 1 | -1, limits: ScaleLimits, ratio = 1.25) =>
	clampScale(direction > 0 ? scale * ratio : scale / ratio, limits);

/** 平移，不改变缩放。 */
export const panBy = (viewport: Viewport, dx: number, dy: number): Viewport => ({
	scale: viewport.scale,
	x: viewport.x + dx,
	y: viewport.y + dy,
});

/** `fitViewport` 的选项。 */
export interface FitOptions {
	/**
	 * 内容与容器边缘的间距（px）。
	 * @default 24
	 */
	padding?: number;
	/**
	 * 适应窗口时的最小缩放：内容太大装不下时停在这里，装不下的部分靠平移。
	 * @default 0.8
	 */
	minScale?: number;
	/**
	 * 适应窗口时的最大缩放：内容较小时不放大超过它。
	 * @default 1
	 */
	maxScale?: number;
	limits?: ScaleLimits;
}

/**
 * 适应窗口：缩放到刚好装下内容，但不低于 `minScale`、不高于 `maxScale`。
 *
 * 每个方向上，内容装得下就居中，装不下就从起始边（加上内边距）开始。
 */
export function fitViewport(container: Size, content: Size, options: FitOptions = {}): Viewport {
	const { padding = 24, minScale = 0.8, maxScale = 1, limits = DEFAULT_SCALE_LIMITS } = options;
	const fits =
		content.width > 0 && content.height > 0
			? Math.min(
					Math.max(container.width - 2 * padding, 1) / content.width,
					Math.max(container.height - 2 * padding, 1) / content.height,
				)
			: 1;
	const scale = clampScale(Math.min(maxScale, Math.max(minScale, fits)), limits);
	const place = (available: number, length: number) =>
		length * scale <= available ? (available - length * scale) / 2 : padding;
	return {
		scale,
		x: place(container.width, content.width),
		y: place(container.height, content.height),
	};
}

/**
 * 平移到刚好露出一个矩形（容器坐标），四周留 `margin`。
 *
 * 已经在窗口内时返回原视口；比窗口还大时对齐到起始边。聚焦的元素据此被带回视野，聚焦环才不会被裁剪。
 */
export function revealRect(
	viewport: Viewport,
	container: Size,
	rect: Rect,
	margin: number,
): Viewport {
	const shift = (start: number, end: number, size: number) => {
		if (end - start + 2 * margin >= size) return margin - start;
		if (start < margin) return margin - start;
		if (end > size - margin) return size - margin - end;
		return 0;
	};
	const dx = shift(rect.left, rect.right, container.width);
	const dy = shift(rect.top, rect.bottom, container.height);
	return dx === 0 && dy === 0 ? viewport : panBy(viewport, dx, dy);
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * 双指缩放：缩放与指间距成比例，起始中点下的内容点跟着现在的中点走（所以双指一起移动就是平移）。
 *
 * @param start - 手势开始时的视口
 * @param from - 手势开始时两指的容器坐标
 * @param to - 两指现在的容器坐标
 */
export function pinchViewport(
	start: Viewport,
	from: readonly [Point, Point],
	to: readonly [Point, Point],
	limits: ScaleLimits,
): Viewport {
	const before = distance(from[0], from[1]);
	if (before === 0) return start;
	const scale = clampScale((start.scale * distance(to[0], to[1])) / before, limits);
	const origin = midpoint(from[0], from[1]);
	const target = midpoint(to[0], to[1]);
	const contentX = (origin.x - start.x) / start.scale;
	const contentY = (origin.y - start.y) / start.scale;
	return { scale, x: target.x - contentX * scale, y: target.y - contentY * scale };
}
