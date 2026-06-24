import type { MouseEvent } from "react";
import { useCallback } from "react";

export interface Rect {
	left: number;
	top: number;
	width: number;
	height: number;
}

/** 鼠标坐标的最小形状（DOM/React 事件通用，便于纯函数测试） */
export interface PointerCoord {
	clientX: number;
	clientY: number;
}

export interface SpotlightPos {
	/** 相对元素左上角的 x（px） */
	x: number;
	/** 相对元素左上角的 y（px） */
	y: number;
}

/**
 * computeSpotlight - 把鼠标坐标换算为元素内坐标（纯函数，便于测）
 *
 * 接受最小 PointerCoord（DOM MouseEvent 与 React MouseEvent 都满足），
 * 鼠标在元素外时 clamp 到边缘，避免聚光跑飞。
 */
export function computeSpotlight(ev: PointerCoord, rect: Rect): SpotlightPos {
	const x = Math.max(0, Math.min(rect.width, ev.clientX - rect.left));
	const y = Math.max(0, Math.min(rect.height, ev.clientY - rect.top));
	return { x, y };
}

/**
 * useSpotlight - 绑定 mousemove，把坐标写到元素 style 变量 --spot-x/--spot-y
 *
 * 用 getBoundingClientRect 取元素视口坐标（offsetLeft 相对 offsetParent，
 * 聚光需要相对元素自身的视口位置）。
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
