import { type RefObject, useLayoutEffect, useRef } from "react";
import type { Point } from "../../core/index.ts";
import { FLIP_SELECTOR, measureFlip } from "./dom.ts";

/** 位置变化（让位、落位）的过渡时长 ms。 */
export const MOTION_MS = 200;
export const MOTION_EASING = "cubic-bezier(0.2, 0, 0, 1)";

export const prefersReducedMotion = () =>
	typeof window.matchMedia === "function" &&
	window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 让位过渡动画的 id：被新的布局变化打断时只取消自己发起的，不碰使用方的动画。 */
const FLIP_ANIMATION_ID = "v-kanban-flip";

/**
 * 其余卡片让位：`key` 变化时对比前后位置，用位移过渡补间。
 *
 * 过渡可以被下一次布局变化打断：卡片从它此刻的位置接着走。记下的位置是不含过渡位移的布局位置，
 * 否则测量会把正在进行的位移算进去，连续打断时误差一正一负越叠越大。
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
		const elements = [...scroller.querySelectorAll<HTMLElement>(FLIP_SELECTOR)];
		// 先量带着过渡位移的当前位置，再取消过渡量布局位置；两者之差是被打断的过渡此刻的位移
		const visual = measureFlip(scroller);
		for (const element of elements)
			for (const animation of element.getAnimations?.() ?? [])
				if (animation.id === FLIP_ANIMATION_ID) animation.cancel();
		const next = measureFlip(scroller);
		const previous = previousPositions.current;
		previousPositions.current = next;
		if (!previous || prefersReducedMotion()) return;
		for (const element of elements) {
			const id = element.getAttribute("data-flip") ?? "";
			const before = previous.get(id);
			const after = next.get(id);
			const now = visual.get(id);
			if (!before || !after || !now) continue;
			// 布局变化前卡片在 before 加上未走完的位移处，从那里补间到新的布局位置
			const dx = before.x - after.x + (now.x - after.x);
			const dy = before.y - after.y + (now.y - after.y);
			if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
			element.animate?.(
				[{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
				{ id: FLIP_ANIMATION_ID, duration: MOTION_MS, easing: MOTION_EASING },
			);
		}
	}, [key, enabled, scrollerRef]);
}
