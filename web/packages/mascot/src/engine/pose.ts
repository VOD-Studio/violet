/**
 * 姿态系统:Pose 运行时状态(数值全具现)与合成纯函数。
 *
 * 合成次序:defaultPose 基态 → applySpec 叠加表情静态层 →
 * animValue/applyAnim 叠加循环动画层 → lerpPose 做表情间过渡插值。
 */

import { lerpColor } from "../lib/color";
import { clamp, lerp, TAU } from "../lib/math";
import type { MouthShapeId } from "./body";
import type { EyeRing } from "./eyes";
import { PALETTE } from "./palette";
import type { Anim, BodyPose, EyePose } from "./types";

/**
 * 两眼环逐点线性插值,实现眼形间的平滑变形。
 *
 * @param a - 起始眼环
 * @param b - 目标眼环
 * @param t - 插值因子 [0, 1]
 * @returns 48 点插值结果,供渲染层按眼睛半径缩放绘制
 */
export function lerpRing(a: EyeRing, b: EyeRing, t: number): [number, number][] {
	const out: [number, number][] = new Array(a.length);
	for (let i = 0; i < a.length; i++) {
		out[i] = [a[i][0] + (b[i][0] - a[i][0]) * t, a[i][1] + (b[i][1] - a[i][1]) * t];
	}
	return out;
}

/** 身体运行时态:BodyPose 的全字段具现(可选转必填,数值零值) */
export interface BodyState {
	x: number;
	y: number;
	scale: number;
	rotate: number;
	/** 纵向拉伸系数:自旋滞空 >1 拉长,落地 <1 压扁,配合横向压缩构成体积守恒 */
	stretchY: number;
	color: string;
	breathe: number;
	blush: number;
	earL: number;
	earR: number;
	tail: number;
	tailElev: number;
	pawY: number;
	pawLX: number;
	pawLY: number;
	pawLRot: number;
	pawLScale: number;
	pawRX: number;
	pawRY: number;
	pawRRot: number;
	pawRScale: number;
	mouth: MouthShapeId;
	mouthY: number;
	mouthScale: number;
	whiskers: number;
	halo: number;
	zzz: number;
}

/** 单眼运行时态:EyePose 的全字段具现;ring 为当前眼环目标形 */
export interface EyeState {
	x: number;
	y: number;
	scaleX: number;
	scaleY: number;
	rotate: number;
	open: number;
	lookX: number;
	lookY: number;
	ring?: EyeRing;
}

/** 一帧完整姿态:身体 + 左右眼 + 自旋偏航角(弧度) */
export interface Pose {
	body: BodyState;
	left: EyeState;
	right: EyeState;
	yaw: number;
}

/** 身体基态:呼吸微动、尾巴半摆、ω 嘴、胡须常显 */
export const DEFAULT_BODY: BodyState = {
	x: 0,
	y: 0,
	scale: 1,
	rotate: 0,
	stretchY: 1,
	color: PALETTE.body,
	breathe: 0.01,
	blush: 0,
	earL: 0,
	earR: 0,
	tail: 0.5,
	tailElev: 0.3,
	pawY: 0,
	pawLX: 0,
	pawLY: 0,
	pawLRot: 0,
	pawLScale: 1,
	pawRX: 0,
	pawRY: 0,
	pawRRot: 0,
	pawRScale: 1,
	mouth: "w",
	mouthY: 0,
	mouthScale: 1,
	whiskers: 1,
	halo: 0,
	zzz: 0,
};

/** 单眼基态:常开、无偏移、无视线 */
export const DEFAULT_EYE: EyeState = {
	x: 0,
	y: 0,
	scaleX: 1,
	scaleY: 1,
	rotate: 0,
	open: 1,
	lookX: 0,
	lookY: 0,
};

/**
 * 构造基态帧:DEFAULT_BODY/DEFAULT_EYE 的深拷贝,yaw 归零。
 *
 * @returns 独立可变的基态 Pose
 */
export function defaultPose(): Pose {
	return {
		body: { ...DEFAULT_BODY },
		left: { ...DEFAULT_EYE },
		right: { ...DEFAULT_EYE },
		yaw: 0,
	};
}

/**
 * 深拷贝一帧姿态(三段展开),供过渡起点快照。
 *
 * @param p - 源姿态
 */
export function clonePose(p: Pose): Pose {
	return { body: { ...p.body }, left: { ...p.left }, right: { ...p.right }, yaw: p.yaw };
}

/**
 * 就地叠加表情静态姿态层(body/eyes)到 Pose。
 *
 * pawL/pawR 展开为 BodyState 的平铺字段;eyes 按 both→left/right 顺序覆盖。
 *
 * @param pose - 目标姿态(就地修改并返回)
 * @param body - 表情定义的 body 静态层,缺省跳过
 * @param eyes - 表情定义的 eyes 静态层,缺省跳过
 * @returns 传入的 pose(链式)
 */
export function applySpec(
	pose: Pose,
	body?: BodyPose,
	eyes?: { both?: EyePose; left?: EyePose; right?: EyePose },
): Pose {
	if (body) {
		const { pawL, pawR, ...rest } = body;
		Object.assign(pose.body, rest);
		if (pawL) {
			if (pawL.x !== undefined) pose.body.pawLX = pawL.x;
			if (pawL.y !== undefined) pose.body.pawLY = pawL.y;
			if (pawL.rotate !== undefined) pose.body.pawLRot = pawL.rotate;
			if (pawL.scale !== undefined) pose.body.pawLScale = pawL.scale;
		}
		if (pawR) {
			if (pawR.x !== undefined) pose.body.pawRX = pawR.x;
			if (pawR.y !== undefined) pose.body.pawRY = pawR.y;
			if (pawR.rotate !== undefined) pose.body.pawRRot = pawR.rotate;
			if (pawR.scale !== undefined) pose.body.pawRScale = pawR.scale;
		}
	}
	if (eyes) {
		if (eyes.both) {
			Object.assign(pose.left, eyes.both);
			Object.assign(pose.right, eyes.both);
		}
		if (eyes.left) Object.assign(pose.left, eyes.left);
		if (eyes.right) Object.assign(pose.right, eyes.right);
	}
	return pose;
}

/**
 * 两帧姿态插值:数值逐字段 lerp,color 走 RGB 插值,mouth 按过半切换。
 *
 * @param a - 起始帧
 * @param b - 目标帧
 * @param t - 插值因子 [0, 1]
 * @returns 新帧,不改入参
 */
export function lerpPose(a: Pose, b: Pose, t: number): Pose {
	const out = defaultPose();
	for (const part of ["body", "left", "right"] as const) {
		const pa = a[part] as unknown as Record<string, number | string>;
		const pb = b[part] as unknown as Record<string, number | string>;
		const po = out[part] as unknown as Record<string, number | string>;
		for (const k in pb) {
			const vb = pb[k];
			if (typeof vb === "number") {
				const va = typeof pa[k] === "number" ? pa[k] : vb;
				po[k] = lerp(va, vb, t);
			} else if (k === "color" && typeof vb === "string") {
				po.color = lerpColor(typeof pa.color === "string" ? pa.color : vb, vb, t);
			} else if (k === "mouth" && typeof vb === "string") {
				po.mouth = t >= 0.5 ? vb : pa.mouth;
			}
		}
	}
	return out;
}

/**
 * anim 波形原语在时刻 t 的输出值。
 *
 * @param anim - 动画定义
 * @param t - 相对表情开始的毫秒数
 * @param seed - 实例种子,jitter/blink 用它错开同定义实例的相位
 * @returns 该波形此刻的值,叠加语义由 applyAnim 决定
 */
export function animValue(anim: Anim, t: number, seed: number): number {
	const amp = anim.amp ?? 1;
	switch (anim.type) {
		case "sine":
			return amp * Math.sin((TAU * t) / (anim.period ?? 2000) + (anim.phase ?? 0));
		case "pulse":
			return (
				amp * 0.5 * (1 - Math.cos((TAU * t) / (anim.period ?? 1000) + (anim.phase ?? 0)))
			);
		case "jitter": {
			const s = (t / 1000) * (anim.speed ?? 8);
			const v =
				((Math.sin(s * 3.1 + seed) +
					Math.sin(s * 5.7 + seed * 2.3) +
					Math.sin(s * 9.3 + seed * 4.1)) /
					3) *
				amp;
			if (anim.decay) return v * clamp(1 - t / anim.decay, 0, 1);
			return v;
		}
		case "scan": {
			const per = anim.period ?? 800;
			const p = ((((t + (anim.phaseMs ?? 0)) % per) + per) % per) / per;
			const tri = p < 0.5 ? p * 4 - 1 : 3 - p * 4;
			return amp * tri;
		}
		case "glance": {
			const per = anim.period ?? 3600;
			const ph =
				(TAU * ((((t + (anim.phaseMs ?? 0)) % per) + per) % per)) / per + (anim.phase ?? 0);
			return amp * Math.tanh(2.8 * Math.sin(ph));
		}
		case "blink": {
			const interval = anim.period ?? 3800;
			const dur = anim.dur ?? 200;
			const p = (t + (anim.phaseMs ?? 0) + seed * 97) % interval;
			if (p >= dur) return 0;
			return -Math.sin((Math.PI * p) / dur);
		}
	}
}

/**
 * 就地叠加单路动画到 Pose:全部 prop 为加法叠加。
 *
 * @param pose - 目标姿态(就地修改)
 * @param anim - 动画定义
 * @param t - 相对表情开始的毫秒数
 * @param seed - 实例种子
 */
export function applyAnim(pose: Pose, anim: Anim, t: number, seed: number): void {
	const v = animValue(anim, t, seed);
	const targets: EyeState[] | BodyState[] =
		anim.target === "eyes"
			? [pose.left, pose.right]
			: anim.target === "body"
				? [pose.body]
				: anim.target === "left"
					? [pose.left]
					: [pose.right];
	for (const tg of targets) {
		if (anim.prop === "scale") {
			if (tg === pose.body) tg.scale += v;
			else {
				(tg as EyeState).scaleX += v;
				(tg as EyeState).scaleY += v;
			}
		} else if (anim.prop in tg) {
			(tg as unknown as Record<string, number>)[anim.prop] += v;
		}
	}
}
