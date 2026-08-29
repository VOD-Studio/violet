export type StackDirection = "left" | "right";

export interface PhotoStackSlot {
	x: number;
	y: number;
	rotate: number;
	scale: number;
}

/** 将拖动距离归一化到 0~1，超过阈值后保持目标槽位不再继续移动。 */
export function getDragProgress(distance: number, threshold: number) {
	if (threshold <= 0) return 1;
	return Math.min(1, Math.max(0, Math.abs(distance) / threshold));
}

/** 在两个槽位之间插值，后层以负 y 和缩放收进顶卡底边。 */
export function interpolateSlot(from: PhotoStackSlot, to: PhotoStackSlot, progress: number) {
	const t = Math.min(1, Math.max(0, progress));
	return {
		x: from.x + (to.x - from.x) * t,
		y: from.y + (to.y - from.y) * t,
		rotate: from.rotate + (to.rotate - from.rotate) * t,
		scale: from.scale + (to.scale - from.scale) * t,
	};
}

/** 目标方向后层压在非目标方向之上，但始终低于拖动中的顶卡。 */
export function getDirectionalZ(
	direction: StackDirection | null,
	axis: StackDirection,
	depth: number,
) {
	const target = direction !== null && direction === axis;
	return (target ? 70 : 30) - depth;
}

/** 静止槽位：后层向上收进，避免旋转角与底缘越过顶卡。 */
export function getStackSlot(axis: StackDirection, depth: number, width: number): PhotoStackSlot {
	const sign = axis === "left" ? -1 : 1;
	return {
		x: sign * width * 0.055 * depth,
		y: -8 * depth,
		rotate: sign * 1.5 * depth,
		scale: 1 - 0.04 * depth,
	};
}
