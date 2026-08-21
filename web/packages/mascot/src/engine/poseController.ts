/**
 * 姿态控制器:表情切换、时间轴 sequence、眨眼、眼环弹簧、注视/身体
 * 跟随平滑、自旋/弹跳等待机小动作的全部时间状态,逐帧输出 Pose。
 *
 * 不引用任何 SVGElement;宿主输入由 Mascot 门面转发。
 */

import { clamp, easeInOutCubic, lerp, rand, spring, springStep, TAU } from "../lib/math";
import { EMOTION_MAP, EMOTIONS } from "./emotions";
import { EYE_RINGS, type EyeRing } from "./eyes";
import {
	applyAnim,
	applySpec,
	clonePose,
	defaultPose,
	lerpPose,
	lerpRing,
	type Pose,
} from "./pose";
import type { EmotionDef, FrameContext, SequenceFrame } from "./types";

/** 注视幅度(viewBox 像素):横 24 纵 15 */
const GAZE_X = 24;
const GAZE_Y = 15;
/**
 * 身体注视跟随系数:视线看哪边,身体重心微移+微侧倾+轮廓轻压。
 * 次级动作,幅度须比五官滑动小一个量级;侧倾刻意极小——身体底部是平的,
 * 绕贴地点滚转过大会让一侧边缘翘起悬空,破坏贴地的软糯感
 */
const GAZE_LEAN_SHIFT = 0.22;
const GAZE_LEAN_ROT = 0.04;
const GAZE_LEAN_SQUASH = 0.05;
/** 身体跟随平滑速率(1/s):比注视通道(5.66)慢,眼睛先动身体慢半拍跟上 */
const GAZE_LEAN_K = 2.6;
/** 单圈自旋时长 (ms):时间线驱动,角速度均匀、起止缓动 */
const SPIN_TURN_MS = 850;
/** 自旋滞空高度 (viewBox px):抛物线跳起,让旋转发生在空中而非地面拧转 */
const SPIN_HOP = 30;
/** 自旋落地压扁时长 (ms):正弦包络压扁-回弹 */
const SPIN_LAND_MS = 220;
/** 弹跳:4 段递减抛物线 */
const BOUNCE_SEGS = [
	{ d: 0.28, h: 22 },
	{ d: 0.22, h: 11 },
	{ d: 0.16, h: 4 },
	{ d: 0.1, h: 1 },
];
const BOUNCE_TOTAL = BOUNCE_SEGS.reduce((s, q) => s + q.d, 0);

/** 自旋时间线:from → from+delta 经 easeInOutCubic 插值 */
interface SpinTimeline {
	start: number;
	dur: number;
	from: number;
	delta: number;
}

/** 活动中的 sequence:表情的一次性时间轴及其完成状态 */
interface ActiveSequence {
	frames: SequenceFrame[];
	settle: "base" | "hold" | { next: string };
	done: boolean;
}

export class PoseController {
	private def: EmotionDef;
	private seed = Math.random() * 100;
	private emoStart = 0;
	private transStart = 0;
	private transDur = 0;
	private prevPose: Pose | null = null;
	private lastPose: Pose | null = null;
	private seq: ActiveSequence | null = null;
	/** renderStatic 期间暂存的 sequence */
	private seqSaved: ActiveSequence | null = null;

	/* 眼环形变 */
	private ringSrc: [EyeRing, EyeRing] = [EYE_RINGS.round, EYE_RINGS.round];
	private ringDst: [EyeRing, EyeRing] = [EYE_RINGS.round, EYE_RINGS.round];
	private ringCur: [EyeRing, EyeRing] = this.ringDst;
	private ringSpring = spring(1);
	private ringSpeed = 7;
	private poolPos = 0;
	private poolNext = 0;

	/* 眨眼 */
	private openSpring = spring(1);
	private blinkQ: { at: number; v: number }[] = [];
	private blinkNext = Number.POSITIVE_INFINITY;

	/* 自旋 / 弹跳 / 待机小动作 */
	/**
	 * 自旋时间线:delta 落在整圈位 (0 mod τ),结束时 yaw 归零无跳变;
	 * 重复调用从当前角度续转 (反向),不再吞掉用户操作。
	 */
	private spin: SpinTimeline | null = null;
	private bounceAt = -1;
	private anticNext = 0;
	/* 手动偏航角(度):调试用,叠加在自旋时间线上,逐度检查旋转渲染 */
	private devYawDeg = 0;

	/* 注视 */
	private gaze = { x: 0, y: 0, tx: 0, ty: 0 };
	/* 身体跟随平滑值:滞后于 gaze.x,产生眼睛先动身体慢半拍的 follow-through */
	private leanCur = 0;

	/* 摸头持续期 */
	private petUntil = 0;

	constructor(def: EmotionDef) {
		this.def = def;
		this.setEmotion(def);
	}

	/**
	 * 切换表情并重锚时间轴:从当前姿态弹簧过渡到新表情 base,
	 * 触发表情的入场自旋。
	 */
	setEmotion(def: EmotionDef): void {
		const now = performance.now();
		const prevId = this.def.id;
		this.prevPose = this.lastPose ? clonePose(this.lastPose) : null;
		this.def = def;
		this.emoStart = now;
		this.transStart = now;
		this.transDur = this.prevPose ? (def.transition ?? 500) : 0;
		this.seq = def.sequence
			? { frames: def.sequence.frames, settle: def.sequence.settle, done: false }
			: null;

		this.poolPos = 0;
		this.setRing(this.poolRing(0), (def.poolSpeed ?? 6) >= 10 ? 10 : 8);
		this.poolNext =
			now + rand((def.poolMs ?? [9000, 16000])[0], (def.poolMs ?? [9000, 16000])[1]);
		if (prevId !== def.id && def.blinkMs) this.blinkNow(now);
		this.blinkNext = def.blinkMs
			? now + rand(def.blinkMs[0], def.blinkMs[1])
			: Number.POSITIVE_INFINITY;
		this.anticNext = now + rand(2500, 5000);

		if (def.spin) this.spinTurns(def.spin);
	}

	/**
	 * 设置注视目标。
	 *
	 * @param nx - 水平归一化 [-1, 1],越界钳制
	 * @param ny - 垂直归一化 [-1, 1],越界钳制
	 */
	setGaze(nx: number, ny: number): void {
		this.gaze.tx = clamp(nx, -1, 1) * GAZE_X;
		this.gaze.ty = clamp(ny, -1, 1) * GAZE_Y;
	}

	/** 设置手动偏航角(度):调试通道,直接叠加在自旋结果上。 */
	setDevYaw(deg: number): void {
		this.devYawDeg = deg;
	}

	/** 自旋时间线是否仍在进行 */
	hasSpin(): boolean {
		return this.spin !== null;
	}

	/**
	 * 摸头互动持续期:持续期内 compose 输出飞机耳 + 爱心眼覆盖。
	 *
	 * @param durationMs - 持续时间(毫秒),缺省 1200
	 */
	pet(durationMs = 1200): void {
		const now = performance.now();
		this.petUntil = Math.max(this.petUntil, now + durationMs);
	}

	/**
	 * 自旋指定圈数:落点取 n 圈外最近整圈位,结束时 yaw 归零无跳变。
	 *
	 * @param turns - 圈数(向上取整),缺省 1
	 */
	spinTurns(turns = 1): void {
		const now = performance.now();
		const n = Math.max(1, Math.round(turns));
		const from = this.spinYaw(now);
		const dir = this.spin ? (this.spin.delta >= 0 ? -1 : 1) : Math.random() < 0.5 ? -1 : 1;
		// 目标取 n 圈外最近的整圈位:视觉上转满 n 圈落回正面,结束时 yaw→0 无跳变
		const target = Math.round((from + TAU * n * dir) / TAU) * TAU;
		const delta = target - from;
		this.spin = {
			start: now,
			dur: (SPIN_TURN_MS * Math.abs(delta)) / TAU,
			from,
			delta,
		};
	}

	/** 触发一次弹跳;弹跳进行中重复调用不重置。 */
	bounce(): void {
		if (this.bounceAt < 0) this.bounceAt = performance.now();
	}

	/** 静态快照前置:弹簧收敛到终态、禁用过渡与 sequence。 */
	prepareStatic(): void {
		this.transDur = 0;
		this.ringSpring.x = 1;
		this.ringSpring.v = 0;
		this.openSpring.x = this.def.openness ?? 1;
		this.openSpring.v = 0;
		this.seqSaved = this.seq;
		this.seq = null;
	}

	/** 静态快照后置:恢复被禁用的 sequence。 */
	restoreStatic(): void {
		this.seq = this.seqSaved;
		this.seqSaved = null;
	}

	/**
	 * 合成一帧姿态并填充帧上下文(身体跟随参数、光环转速档)。
	 *
	 * @param now - performance.now() 时间戳(毫秒)
	 * @param dt - 帧步长(秒)
	 * @param running - 实例是否在 ticker 中(静态快照期间为 false)
	 * @param frame - 门面复用的帧上下文,就地写入
	 */
	compose(now: number, dt: number, running: boolean, frame: FrameContext): Pose {
		const def = this.def;
		const t = now - this.emoStart;
		let pose: Pose | null = null;

		if (this.seq) {
			const res = this.seqPose(t, now);
			if (res === "switch") {
				return this.compose(now, dt, running, frame);
			}
			if (res) pose = res;
		}
		if (!pose) pose = applySpec(defaultPose(), def.body, def.eyes);

		const br = pose.body.breathe || 0;
		if (br) {
			const ph = (TAU * now) / 3600;
			pose.body.scale += br * Math.sin(ph);
			pose.body.y += br * 45 * Math.sin(ph + 0.6);
		}

		for (const anim of def.anims ?? []) applyAnim(pose, anim, t, this.seed);

		if (running && now >= this.poolNext) {
			if (def.pool.length > 1 && !def.pair) {
				this.poolPos =
					(this.poolPos + 1 + Math.floor(rand(0, def.pool.length - 1))) % def.pool.length;
				this.setRing(this.poolRing(this.poolPos), def.poolSpeed ?? 6);
			}
			this.poolNext =
				now + rand((def.poolMs ?? [9000, 16000])[0], (def.poolMs ?? [9000, 16000])[1]);
		}

		if (running && def.blinkMs && now >= this.blinkNext) {
			this.blinkNow(now);
			this.blinkNext = now + rand(def.blinkMs[0], def.blinkMs[1]);
		}
		let openKey: number | null = null;
		while (this.blinkQ.length && now >= this.blinkQ[0].at) {
			openKey = this.blinkQ[0].v;
			this.blinkQ.shift();
		}
		this.openSpring.t =
			openKey ?? (this.blinkQ.length ? this.openSpring.t : (def.openness ?? 1));

		if (running && def.antics && now >= this.anticNext) {
			if (!this.spin && this.bounceAt < 0) {
				const pick = Math.random();
				if (pick < 0.45) this.spinTurns(1);
				else if (pick < 0.8) this.bounce();
				else this.blinkNow(now);
			}
			this.anticNext = now + rand(9000, 18000);
		}

		const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
		const j = dt / steps;

		for (let si = 0; si < steps; si++) {
			springStep(this.ringSpring, this.ringSpeed, 1, j);
			springStep(this.openSpring, 26, 1, j);
		}
		pose.yaw = this.spinYaw(now) + (this.devYawDeg / 180) * Math.PI;
		if (this.spin) {
			const raw = (now - this.spin.start) / this.spin.dur;
			if (raw < 1) {
				// 滞空:抛物线跳起 + 纵向拉伸(体积守恒),旋转发生在空中
				const hop = Math.sin(Math.PI * raw);
				pose.body.y += -SPIN_HOP * hop;
				pose.body.stretchY += 0.22 * hop;
			} else {
				// 落地压扁回弹:横向鼓出纵向压扁,正弦包络落回 1
				const land = clamp((now - this.spin.start - this.spin.dur) / SPIN_LAND_MS, 0, 1);
				const sq = Math.sin(Math.PI * land);
				pose.body.scale += 0.07 * sq;
				pose.body.stretchY += -0.2 * sq;
				if (land >= 1) this.spin = null;
			}
		}

		if (this.bounceAt >= 0) {
			const be = (now - this.bounceAt) / 1000;
			if (be >= BOUNCE_TOTAL) {
				this.bounceAt = -1;
			} else {
				let acc = 0;
				let bi = 0;
				while (bi < BOUNCE_SEGS.length && be >= acc + BOUNCE_SEGS[bi].d) {
					acc += BOUNCE_SEGS[bi].d;
					bi++;
				}
				const seg = BOUNCE_SEGS[Math.min(bi, BOUNCE_SEGS.length - 1)];
				const bn = (be - acc) / seg.d;
				pose.body.y += -4 * seg.h * bn * (1 - bn);
			}
		}

		if (this.ringSpring.x < 0.999 || this.ringSpring.v > 0.001 || this.ringSpring.v < -0.001) {
			const rs = clamp(this.ringSpring.x, 0, 1.35);
			this.ringCur = [
				lerpRing(this.ringSrc[0], this.ringDst[0], rs),
				lerpRing(this.ringSrc[1], this.ringDst[1], rs),
			];
		} else if (this.ringCur !== this.ringDst) {
			this.ringCur = this.ringDst;
		}
		pose.left.ring = this.ringCur[0];
		pose.right.ring = this.ringCur[1];

		const k = 1 - Math.exp(-5.66 * dt);
		const gx = def.gaze !== false ? this.gaze.tx : 0;
		const gy = def.gaze !== false ? this.gaze.ty : 0;
		this.gaze.x += (gx - this.gaze.x) * k;
		this.gaze.y += (gy - this.gaze.y) * k;
		pose.left.lookX += this.gaze.x;
		pose.right.lookX += this.gaze.x;
		pose.left.lookY += this.gaze.y;
		pose.right.lookY += this.gaze.y;

		if (def.gaze !== false) {
			const w = now / 1000;
			pose.left.lookX += 1.4 * Math.sin(0.42 * w) + 0.5 * Math.sin(1.0 * w);
			pose.right.lookX += 1.4 * Math.sin(0.42 * w + 1) + 0.5 * Math.sin(1.0 * w + 2);
			pose.left.lookY += 0.9 * Math.sin(0.58 * w);
			pose.right.lookY += 0.9 * Math.sin(0.58 * w + 1);
		}

		const openS = clamp(this.openSpring.x, 0.02, 1.5);
		pose.left.open = clamp(pose.left.open, 0, 1.3) * openS;
		pose.right.open = clamp(pose.right.open, 0, 1.3) * openS;
		pose.left.scaleX = Math.max(pose.left.scaleX, 0.05);
		pose.left.scaleY = Math.max(pose.left.scaleY, 0.05);
		pose.right.scaleX = Math.max(pose.right.scaleX, 0.05);
		pose.right.scaleY = Math.max(pose.right.scaleY, 0.05);

		// 摸头覆盖:飞机耳 + 腮红 + purr 眯眼
		if (running && now < this.petUntil) {
			const petProg = clamp((this.petUntil - now) / 1200, 0, 1);
			const petEasing = Math.sin(Math.PI * petProg);
			pose.body.earL = lerp(pose.body.earL, -22, petEasing);
			pose.body.earR = lerp(pose.body.earR, 22, petEasing);
			pose.body.blush = Math.max(pose.body.blush, 0.75 * petEasing);
			pose.body.scale += 0.02 * Math.sin((TAU * now) / 450) * petEasing;
			pose.left.ring = EYE_RINGS.purr;
			pose.right.ring = EYE_RINGS.purr;
			pose.left.open = 0.45;
			pose.right.open = 0.45;
			pose.body.mouth = "w";
		}

		const tt = now - this.transStart;
		if (this.transDur > 0 && tt < this.transDur && this.prevPose) {
			pose = lerpPose(this.prevPose, pose, easeInOutCubic(tt / this.transDur));
		}

		// 身体注视跟随(次级动作):仅指针注意力(gaze.x)驱动——avgLookX 还混有
		// 微漂移与表情 lookX 动画(scan 类),直接用会连带身体摇摆。独立慢平滑
		// 让身体比眼睛慢半拍跟上,产生 follow-through 而非刚体同进同退
		this.leanCur += (this.gaze.x - this.leanCur) * (1 - Math.exp(-GAZE_LEAN_K * dt));
		frame.leanShift = this.leanCur * GAZE_LEAN_SHIFT;
		frame.leanRot = this.leanCur * GAZE_LEAN_ROT;
		frame.leanSquash = 1 - GAZE_LEAN_SQUASH * (Math.abs(this.leanCur) / GAZE_X);
		frame.haloFast = (def.poolMs?.[0] ?? 2000) < 600;
		this.lastPose = pose;
		return pose;
	}

	/** 当前自旋偏航角 (rad);无自旋时为 0 */
	private spinYaw(now: number): number {
		const s = this.spin;
		if (!s) return 0;
		const u = clamp((now - s.start) / s.dur, 0, 1);
		return s.from + s.delta * easeInOutCubic(u);
	}

	private poolRing(pos: number): [EyeRing, EyeRing] {
		const def = this.def;
		if (def.pair) return [EYE_RINGS[def.pair[0]], EYE_RINGS[def.pair[1]]];
		const shape = EYE_RINGS[def.pool[pos] ?? "round"];
		return [shape, shape];
	}

	private setRing(dst: [EyeRing, EyeRing], speed: number): void {
		const s = clamp(this.ringSpring.x, 0, 1);
		this.ringSrc = [
			lerpRing(this.ringSrc[0], this.ringDst[0], s),
			lerpRing(this.ringSrc[1], this.ringDst[1], s),
		];
		this.ringDst = dst;
		this.ringSpring.x = 0;
		this.ringSpring.v = 0;
		this.ringSpring.t = 1;
		this.ringSpeed = speed;
	}

	/** 眨眼关键帧:闭合-闭合-过冲睁开-回落,偶发双眨 */
	private blinkNow(t: number): void {
		this.blinkQ.push(
			{ at: t, v: 0.05 },
			{ at: t + 70, v: 0.05 },
			{ at: t + 150, v: 1.08 },
			{ at: t + 300, v: 1 },
		);
		if (Math.random() < 0.14) {
			this.blinkQ.push({ at: t + 370, v: 0.05 }, { at: t + 480, v: 1 });
		}
	}

	private seqPose(t: number, now: number): Pose | null | "switch" {
		const seq = this.seq;
		if (!seq) return null;
		const frames = seq.frames;
		const last = frames[frames.length - 1];

		if (t >= last.at) {
			if (!seq.done) {
				seq.done = true;
				if (seq.settle === "base") {
					this.prevPose = this.lastPose
						? clonePose(this.lastPose)
						: applySpec(defaultPose(), last.body, last.eyes);
					this.transStart = now;
					this.transDur = this.def.transition ?? 500;
					this.seq = null;
					return null;
				}
				if (typeof seq.settle === "object" && seq.settle.next) {
					this.setEmotion(EMOTION_MAP.get(seq.settle.next) ?? EMOTIONS[0]);
					return "switch";
				}
			}
			return applySpec(
				applySpec(defaultPose(), this.def.body, this.def.eyes),
				last.body,
				last.eyes,
			);
		}

		if (t <= frames[0].at)
			return applySpec(
				applySpec(defaultPose(), this.def.body, this.def.eyes),
				frames[0].body,
				frames[0].eyes,
			);
		for (let i = 0; i < frames.length - 1; i++) {
			const a = frames[i];
			const b = frames[i + 1];
			if (t >= a.at && t < b.at) {
				const pa = applySpec(defaultPose(), this.def.body, this.def.eyes);
				const pb = applySpec(defaultPose(), this.def.body, this.def.eyes);
				applySpec(pa, a.body, a.eyes);
				applySpec(pb, b.body, b.eyes);
				return lerpPose(pa, pb, easeInOutCubic((t - a.at) / (b.at - a.at)));
			}
		}
		return applySpec(
			applySpec(defaultPose(), this.def.body, this.def.eyes),
			last.body,
			last.eyes,
		);
	}
}
