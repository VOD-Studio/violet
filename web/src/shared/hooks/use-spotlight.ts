import type { MouseEvent } from "react";
import { useCallback } from "react";

/** 矩形边界参数 */
export interface Rect {
	left: number;
	top: number;
	width: number;
	height: number;
}

/** 鼠标指针坐标最小形状 */
export interface PointerCoord {
	clientX: number;
	clientY: number;
}

/** 聚光灯在元素内部的像素坐标 */
export interface SpotlightPos {
	/** 相对元素左上角 X 轴偏移（px） */
	x: number;
	/** 相对元素左上角 Y 轴偏移（px） */
	y: number;
}

/**
 * 将鼠标视口坐标换算为元素内部相对坐标，越界时自动限制在边缘（纯函数）。
 *
 * @param ev - 鼠标坐标
 * @param rect - 目标元素边界矩形
 *
 * @returns 限制在元素范围内的相对像素坐标
 */
export function computeSpotlight(ev: PointerCoord, rect: Rect): SpotlightPos {
	const x = Math.max(0, Math.min(rect.width, ev.clientX - rect.left));
	const y = Math.max(0, Math.min(rect.height, ev.clientY - rect.top));
	return { x, y };
}

/**
 * 为元素绑定鼠标移动事件，通过 CSS 变量 `--spot-x` / `--spot-y` 驱动聚光灯光晕跟随效果。
 *
 * @returns `onMouseMove` 鼠标移动事件回调
 *
 * @example
 * ```tsx
 * const onMouseMove = useSpotlight();
 * return <div onMouseMove={onMouseMove} className="spotlight-card" />;
 * ```
 */
export function useSpotlight() {
	return useCallback((e: MouseEvent<HTMLDivElement>) => {
		const el = e.currentTarget;
		const r = el.getBoundingClientRect();
		const pos = computeSpotlight(e, {
			left: r.left,
			top: r.top,
			width: r.width,
			height: r.height,
		});
		el.style.setProperty("--spot-x", `${pos.x}px`);
		el.style.setProperty("--spot-y", `${pos.y}px`);
	}, []);
}
