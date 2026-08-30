import type { MotionValue } from "motion/react";

export type StackDirection = "left" | "right";

export interface PhotoStackSlot {
	x: number;
	y: number;
	rotate: number;
	scale: number;
}

export const PULL_THRESHOLD_RATIO = 0.8;
export const INSERT_THRESHOLD_RATIO = 1.2;
export const DRAG_ROTATE_PER_PX = 0.015;
export const DRAG_ROTATE_MAX = 4;
export const DRAG_ROTATE_Y_PER_PX = 0.06;
export const DRAG_ROTATE_Y_MAX = 12;

export interface DraggedTopSlotResult {
	topSlot: PhotoStackSlot;
	rotateY: number;
	isPastThreshold: boolean;
	pullProgress: number;
	insertProgress: number;
}

/** 计算顶卡拖动过程中的位置、缩放、平面旋转与透视旋转。 */
export function getDraggedTopSlot(
	rawDelta: number,
	width: number,
	canFlip: boolean,
): DraggedTopSlotResult {
	if (width <= 0) {
		return {
			topSlot: { x: 0, y: 0, rotate: 0, scale: 1 },
			rotateY: 0,
			isPastThreshold: false,
			pullProgress: 0,
			insertProgress: 0,
		};
	}
	const distance = Math.abs(rawDelta);
	const pullThreshold = width * PULL_THRESHOLD_RATIO;
	const insertThreshold = width * INSERT_THRESHOLD_RATIO;
	const pullProgress = Math.min(1, distance / Math.max(1, pullThreshold));
	const scale = 1 - 0.104 * pullProgress;
	const rotate = Math.max(
		-DRAG_ROTATE_MAX,
		Math.min(DRAG_ROTATE_MAX, rawDelta * DRAG_ROTATE_PER_PX),
	);
	const rotateY = Math.max(
		-DRAG_ROTATE_Y_MAX,
		Math.min(DRAG_ROTATE_Y_MAX, rawDelta * DRAG_ROTATE_Y_PER_PX),
	);
	if (!canFlip) {
		const rubberX =
			Math.sign(rawDelta) *
			width *
			0.08 *
			(1 - Math.exp(-distance / (width * 0.08)));
		return {
			topSlot: { x: rubberX, y: 0, rotate, scale },
			rotateY,
			isPastThreshold: false,
			pullProgress: 0,
			insertProgress: 0,
		};
	}
	if (distance <= pullThreshold) {
		return {
			topSlot: { x: rawDelta, y: 0, rotate, scale },
			rotateY,
			isPastThreshold: false,
			pullProgress: distance / pullThreshold,
			insertProgress: 0,
		};
	}
	const insertProgress = Math.min(
		1,
		(distance - pullThreshold) / Math.max(1, insertThreshold - pullThreshold),
	);
	const peakSlot = { x: Math.sign(rawDelta) * pullThreshold, y: 0, rotate, scale };
	const rearSlot = getStackSlot(rawDelta < 0 ? "left" : "right", 1, width);
	return {
		topSlot: interpolateSlot(peakSlot, rearSlot, insertProgress),
		rotateY: rotateY * (1 - insertProgress),
		isPastThreshold: true,
		pullProgress: 1,
		insertProgress,
	};
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

/** 拖拽超过拉出阈值（isPastThreshold 为 true）时，目标侧首张后卡才升至最顶层（置顶）；未达阈值前当前卡始终保持最顶层。 */
export function getDirectionalZ(
	direction: StackDirection | null,
	axis: StackDirection,
	depth: number,
	isPastThreshold = false,
) {
	if (direction !== null && direction === axis && depth === 1 && isPastThreshold) {
		return 100;
	}
	const target = direction !== null && direction === axis;
	return (target ? 70 : 30) - depth;
}

/** 静止槽位：后置卡保持既有偏移、旋转与缩放几何。 */
export function getStackSlot(axis: StackDirection, depth: number, width: number): PhotoStackSlot {
	const sign = axis === "left" ? -1 : 1;
	return {
		x: sign * width * 0.106132 * depth,
		y: 4 * depth,
		rotate: sign * 1.0 * depth,
		scale: 1 - 0.104 * depth,
	};
}
export interface MotionBundle {
	x: MotionValue<number>;
	y: MotionValue<number>;
	rotate: MotionValue<number>;
	rotateY: MotionValue<number>;
	scale: MotionValue<number>;
	opacity: MotionValue<number>;
}
export function setStackSlot(value: MotionBundle, slot: PhotoStackSlot, opacity = 1) {
	value.x.stop();
	value.y.stop();
	value.rotate.stop();
	value.rotateY.stop();
	value.scale.stop();
	value.opacity.stop();
	value.x.set(slot.x);
	value.y.set(slot.y);
	value.rotate.set(slot.rotate);
	value.rotateY.set(0);
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
