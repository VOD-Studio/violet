import type { Variants } from "motion/react";

/** 轴线自左向右绘制的时长，节点与季节标签按线条进度依次显现。 */
export const LINE_DRAW_SECONDS = 0.9;

/**
 * 元素在线条抵达其位置时开始显现的延迟。
 *
 * @param position 元素在时间线上的百分比位置
 * @param todayPosition 轴线终点（今日刻度）的百分比位置
 */
export function revealDelay(position: number, todayPosition: number): number {
	return Math.min(position / Math.max(todayPosition, 1), 1) * LINE_DRAW_SECONDS;
}

/** 由时间线容器统一触发，`custom` 传入显现延迟秒数。 */
export const revealVariants: Variants = {
	hidden: { opacity: 0 },
	shown: (delay: number) => ({
		opacity: 1,
		transition: { duration: 0.35, delay, ease: "easeOut" },
	}),
};
