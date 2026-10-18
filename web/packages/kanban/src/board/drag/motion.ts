import { type RefObject, useLayoutEffect, useRef } from "react";
import type { Point } from "../../core/index.ts";
import { FLIP_SELECTOR, measureFlip } from "./dom.ts";

/** 位置变化（让位、落位）的过渡时长 ms。 */
export const MOTION_MS = 200;
export const MOTION_EASING = "cubic-bezier(0.2, 0, 0, 1)";

export const prefersReducedMotion = () =>
	typeof window.matchMedia === "function" &&
	window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * 其余卡片让位：`key` 变化时对比前后位置，用位移过渡补间。
 *
 * @param key - 布局发生变化的指纹；值本身不参与计算
 * @param enabled - 关闭时不测量也不补间
 */
export function useFlip(scrollerRef: RefObject<HTMLElement | null>, key: string, enabled: boolean) {
	const previousPositions = useRef<Map<string, Point> | null>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: key 仅作触发器，副作用读取的是 DOM 布局而非它的值
	useLayoutEffect(() => {
		const scroller = scrollerRef.current;
		if (!scroller || !enabled) {
			previousPositions.current = null;
			return;
		}
		const next = measureFlip(scroller);
		const previous = previousPositions.current;
		previousPositions.current = next;
		if (!previous || prefersReducedMotion()) return;
		for (const element of scroller.querySelectorAll<HTMLElement>(FLIP_SELECTOR)) {
			const id = element.getAttribute("data-flip") ?? "";
			const before = previous.get(id);
			const after = next.get(id);
			if (!before || !after || (before.x === after.x && before.y === after.y)) continue;
			element.animate?.(
				[
					{ transform: `translate(${before.x - after.x}px, ${before.y - after.y}px)` },
					{ transform: "none" },
				],
				{ duration: MOTION_MS, easing: MOTION_EASING },
			);
		}
	}, [key, enabled, scrollerRef]);
}
