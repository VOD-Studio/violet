import type { CropRect } from "../types";
import type { Size } from "./crop-display";

/** 取景状态：视野中心（相对原图 0~1）与缩放倍数（1 = 刚好铺满取景框）。 */
export interface FrameView {
	cx: number;
	cy: number;
	zoom: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 5;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * 当前视野对应的归一化选区。
 *
 * zoom=1 时图片刚好 cover 取景框：图比框宽则高度占满，否则宽度占满。
 * 中心会被夹住，保证选区不越出原图。
 */
export function viewToRect(view: FrameView, natural: Size, aspect: number): CropRect {
	const zoom = clamp(view.zoom, MIN_ZOOM, MAX_ZOOM);
	const ratio = natural.w / natural.h;
	const w = ratio >= aspect ? aspect / (ratio * zoom) : 1 / zoom;
	const h = ratio >= aspect ? 1 / zoom : ratio / (aspect * zoom);
	return {
		x: clamp(view.cx - w / 2, 0, 1 - w),
		y: clamp(view.cy - h / 2, 0, 1 - h),
		w,
		h,
	};
}

/** 选区回到视野中心。 */
export function rectToView(rect: CropRect, zoom: number): FrameView {
	return { cx: rect.x + rect.w / 2, cy: rect.y + rect.h / 2, zoom };
}

/** 按帧内像素位移平移（图片跟手：向右拖，视野向左）。 */
export function panView(
	view: FrameView,
	natural: Size,
	aspect: number,
	deltaPx: { x: number; y: number },
	frame: Size,
): FrameView {
	const rect = viewToRect(view, natural, aspect);
	return rectToView(
		viewToRect(
			{
				cx: rect.x + rect.w / 2 - (deltaPx.x * rect.w) / frame.w,
				cy: rect.y + rect.h / 2 - (deltaPx.y * rect.h) / frame.h,
				zoom: view.zoom,
			},
			natural,
			aspect,
		),
		clamp(view.zoom, MIN_ZOOM, MAX_ZOOM),
	);
}

/**
 * 以取景框内某点（0~1）为锚点缩放，锚点下的图像位置保持不动。
 * anchor 缺省为框中心。
 */
export function zoomView(
	view: FrameView,
	natural: Size,
	aspect: number,
	nextZoom: number,
	anchor: { x: number; y: number } = { x: 0.5, y: 0.5 },
): FrameView {
	const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
	const before = viewToRect(view, natural, aspect);
	const px = before.x + anchor.x * before.w;
	const py = before.y + anchor.y * before.h;
	const after = viewToRect({ ...view, zoom }, natural, aspect);
	const next = viewToRect(
		{
			cx: px - anchor.x * after.w + after.w / 2,
			cy: py - anchor.y * after.h + after.h / 2,
			zoom,
		},
		natural,
		aspect,
	);
	return rectToView(next, zoom);
}
