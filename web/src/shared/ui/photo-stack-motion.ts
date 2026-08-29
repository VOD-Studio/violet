import type { MotionValue } from "motion/react";

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

/** 顶图随指针持续移动，并平滑渐近整张卡宽，避免硬停或完全离开图集。 */
export function getDragOffset(distance: number, width: number) {
	if (width <= 0) return 0;
	return Math.sign(distance) * width * 0.9 * (1 - Math.exp(-Math.abs(distance) / width));
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

export interface MotionBundle {
	x: MotionValue<number>;
	y: MotionValue<number>;
	rotate: MotionValue<number>;
	scale: MotionValue<number>;
	opacity: MotionValue<number>;
}

/** 立即落位一组 MotionValue；先停掉在跑的动画，避免 set 被逐帧覆盖。 */
export function setStackSlot(value: MotionBundle, slot: PhotoStackSlot, opacity = 1) {
	value.x.stop();
	value.y.stop();
	value.rotate.stop();
	value.scale.stop();
	value.opacity.stop();
	value.x.set(slot.x);
	value.y.set(slot.y);
	value.rotate.set(slot.rotate);
	value.scale.set(slot.scale);
	value.opacity.set(opacity);
}

/** MotionValue 缓存与 React key 共用同一身份，换层时不会重挂载。 */
export function cardMotionKey(imageSrc: string, index: number) {
	return `${imageSrc}-${index}`;
}

export interface DragSample {
	t: number;
	x: number;
}

/** 保留最近的拖动采样，供松手时计算轻扫速度。 */
export function recordSample(samples: DragSample[], t: number, x: number, limit = 6) {
	samples.push({ t, x });
	if (samples.length > limit) samples.shift();
}

/** 窗口期内的平均速度，单位 px/ms；窗口内样本不足或时间戳无进展时返回 0。 */
export function recentVelocity(samples: DragSample[], windowMs = 100) {
	if (samples.length < 2) return 0;
	const last = samples[samples.length - 1];
	let first: DragSample | null = null;
	for (let i = samples.length - 2; i >= 0; i -= 1) {
		if (last.t - samples[i].t <= windowMs) first = samples[i];
		else break;
	}
	if (!first) return 0;
	const dt = last.t - first.t;
	return dt > 0 ? (last.x - first.x) / dt : 0;
}

/** 轻扫翻页的最小位移与速度；速度方向需与位移一致，防止反向急停误判。 */
const FLICK_MIN_DISTANCE = 24;
const FLICK_VELOCITY = 0.45;

/** 距离达标即翻页；位移不足但快速轻扫同样翻页。 */
export function shouldFlip(delta: number, velocity: number, threshold: number, canFlip: boolean) {
	if (!canFlip || delta === 0) return false;
	if (Math.abs(delta) >= threshold) return true;
	if (Math.abs(delta) < FLICK_MIN_DISTANCE) return false;
	return Math.abs(velocity) >= FLICK_VELOCITY && Math.sign(velocity) === Math.sign(delta);
}
