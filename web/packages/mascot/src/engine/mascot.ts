/**
 * Mascot 引擎 —— 软萌猫猫团 (Cat-Mochi) 渲染状态机与共享 ticker。
 *
 * 核心架构：
 *   - 渲染层：带质感径向渐变、地底软阴影、灵动猫耳系统 (外耳+内耳耳窝, 独立支点旋转)、
 *     摇曳尾巴、胸前肉垫小爪爪、腮红、球面投影眼环。
 *   - 物理与姿态：pose 合成 (base/sequence/anims/过渡) 见 pose.ts、临界阻尼弹簧见 math.ts、
 *     眨眼关键帧过冲、眼神微漂移、自旋 yaw 球面投影、4 段衰减弹跳、antics 待机小动作。
 */

import { shade } from "../lib/color";
import { clamp, easeInOutCubic, lerp, rand, spring, springStep, TAU } from "../lib/math";
import {
	CAT_EARS,
	CAT_WHISKERS,
	catMochiOutline,
	catTailPath,
	FACE,
	MOUTH_SHAPES,
	type MouthShapeId,
	smoothClosedPath,
} from "./body";
import { DEFAULT_EMOTION_ID, EMOTION_MAP, EMOTIONS } from "./emotions";
import { EYE_RINGS, type EyeRing } from "./eyes";
import { PALETTE } from "./palette";
import {
	applyAnim,
	applySpec,
	type BodyState,
	clonePose,
	defaultPose,
	type EyeState,
	lerpPose,
	lerpRing,
	type Pose,
} from "./pose";
import type { EmotionDef, SequenceFrame } from "./types";

/**
 * 引擎实例化选项。
 */
export interface MascotOptions {
	/** 初始表情 ID;缺省待机,未知值回退待机 */
	emotion?: string;
	/** 渲染一帧静态快照后停表(目录缩略卡用);可后续 start() 或手动 tick 驱动 */
	frozen?: boolean;
	/** 点击身体回调 */
	onClick?: () => void;
	/** 摸头命中回调(头部区域指针停留) */
	onPet?: () => void;
}

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
/**
 * 面部柱面统一投影半径:全部面部部件锚在同一圆周上,
 * 位置/透视压缩/淡出共用同一条球面投影曲线,构成刚体式整脸旋转。
 */
const FACE_R = 52;
/** 身体跟随平滑速率(1/s):比注视通道(5.66)慢,眼睛先动身体慢半拍跟上 */
const GAZE_LEAN_K = 2.6;
/** 单圈自旋时长 (ms):时间线驱动,角速度均匀、起止缓动 */
const SPIN_TURN_MS = 850;
/** 自旋滞空高度 (viewBox px):抛物线跳起,让旋转发生在空中而非地面拧转 */
const SPIN_HOP = 30;
/** 自旋落地压扁时长 (ms):正弦包络压扁-回弹 */
const SPIN_LAND_MS = 220;
const CONFETTI_COLORS = ["#8B7CF6", "#6D5CE7", "#F4C34E", "#F472B6", "#34D399", "#FB923C"];
/** 五角星 path */
const STAR_PATH = (() => {
	const pts: string[] = [];
	for (let i = 0; i < 10; i++) {
		const a = (i * Math.PI) / 5 - Math.PI / 2;
		const r = i % 2 === 0 ? 1 : 0.42;
		pts.push(`${(Math.cos(a) * r).toFixed(3)},${(Math.sin(a) * r).toFixed(3)}`);
	}
	return `M ${pts.join(" L ")} Z`;
})();
/** 弹跳:4 段递减抛物线 */
const BOUNCE_SEGS = [
	{ d: 0.28, h: 22 },
	{ d: 0.22, h: 11 },
	{ d: 0.16, h: 4 },
	{ d: 0.1, h: 1 },
];
const BOUNCE_TOTAL = BOUNCE_SEGS.reduce((s, q) => s + q.d, 0);

/* ---------- 共享 ticker ---------- */

const active = new Set<Mascot>();
let rafId = 0;
let lastT = 0;

function loop(now: number) {
	const dt = Math.min((now - lastT) / 1000, 0.1);
	lastT = now;
	for (const m of active) m.tick(now, dt);
	rafId = active.size > 0 ? requestAnimationFrame(loop) : 0;
}
/* ---------- 粒子 ---------- */

interface ConfettiPiece {
	el: SVGElement;
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	max: number;
	r: number;
	rot: number;
	vr: number;
	stretch: number;
}
/* ---------- 自旋彩带 ---------- */

/** 轨道点:绕身体中心的倾斜圆轨道 3D 投影,z 决定画在身体前层还是后层 */
interface RibbonPoint {
	x: number;
	y: number;
	z: number;
	l: number;
}

interface RibbonOrbit {
	/** 经度 */
	lam: number;
	/** 自转角速度 (rad/s) */
	lamVel: number;
	/** 轨道面倾角 */
	tilt: number;
	/** 轨道面滚转 */
	roll: number;
	/** 轨道半径 */
	rad: number;
	radVel: number;
	/** 跟随自旋的比例 */
	follow: number;
	/** 惯性携带角速度 */
	carry: number;
	/** 拖尾弧长 (rad) */
	arc: number;
}

interface Ribbon {
	o: RibbonOrbit;
	hist: RibbonPoint[];
	life: number;
	/** 回缩进度 0~1 */
	ret: number;
	r: number;
	hue: number;
	hueSpan: number;
	hueVel: number;
	back: SVGPathElement;
	front: SVGPathElement;
	gradEl: SVGElement;
	stops: SVGStopElement[];
}
let uidCounter = 0;

export class Mascot {
	private static readonly FALLBACK = EMOTIONS[0];

	private def: EmotionDef;
	private destroyed = false;
	private uid = ++uidCounter;
	private svg!: SVGSVGElement;
	private shadowEl!: SVGEllipseElement;
	private rigG!: SVGGElement;
	private tailEl!: SVGPathElement;
	private bodyPath!: SVGPathElement;
	private bodyGrad!: SVGElement;
	private earLG!: SVGGElement;
	private earRG!: SVGGElement;
	private earLOuter!: SVGPathElement;
	private earROuter!: SVGPathElement;
	private earLInner!: SVGPathElement;
	private earRInner!: SVGPathElement;
	private whiskerLG!: SVGGElement;
	private whiskerRG!: SVGGElement;
	private whiskerLTop!: SVGPathElement;
	private whiskerLBot!: SVGPathElement;
	private whiskerRTop!: SVGPathElement;
	private whiskerRBot!: SVGPathElement;
	private blushL!: SVGEllipseElement;
	private blushR!: SVGEllipseElement;
	private eyeLG!: SVGGElement;
	private eyeRG!: SVGGElement;
	private eyeLNode!: SVGPathElement;
	private eyeRNode!: SVGPathElement;
	private eyeLSparkleA!: SVGCircleElement;
	private eyeLSparkleB!: SVGCircleElement;
	private eyeRSparkleA!: SVGCircleElement;
	private eyeRSparkleB!: SVGCircleElement;
	private mouthG!: SVGGElement;
	private mouthCavity!: SVGPathElement;
	private mouthTongue!: SVGPathElement;
	private mouthLine!: SVGPathElement;
	private curMouthShape: MouthShapeId = "w";
	private pawLG!: SVGGElement;
	private pawRG!: SVGGElement;
	private haloG!: SVGGElement;
	private haloDots: SVGCircleElement[] = [];
	private zzzEls: SVGTextElement[] = [];
	private fxLayer!: SVGGElement;
	/* 彩带后层(画在身体之下,被身体遮挡的轨道段)与 defs 引用 */
	private fxBackG!: SVGGElement;
	private defsEl!: SVGElement;

	/* 渐变 Stops 用于动态变色 */
	private gradStopA!: SVGStopElement;
	private gradStopB!: SVGStopElement;
	private gradStopC!: SVGStopElement;

	/* pose 合成状态 */
	private seed = Math.random() * 100;
	private emoStart = 0;
	private transStart = 0;
	private transDur = 0;
	private prevPose: Pose | null = null;
	private lastPose: Pose | null = null;

	/* 抚摸 / 摸摸头状态 (Petting) */
	private petUntil = 0;
	private lastPetCheck = 0;
	private petMoveDist = 0;
	private lastPointerPos = { x: 0, y: 0 };

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
	 * 自旋时间线:from → from+delta 经 easeInOutCubic 插值。
	 * delta 落在整圈位 (0 mod τ),结束时 yaw 归零无跳变;
	 * 重复调用从当前角度续转 (反向),不再吞掉用户操作。
	 */
	private spin: { start: number; dur: number; from: number; delta: number } | null = null;
	/* 自旋彩带:3D 倾斜轨道拖尾,前后分层遮挡,承载旋转可读性 */
	private ribbons: Ribbon[] = [];
	private ribbonPlane: { tilt: number; roll: number; count: number; baseHue: number } | null =
		null;
	private ribbonSpawnAt: number[] = [];
	private ribbonSpawnIdx = 0;
	private ribbonPrevYaw = 0;
	private ribbonWasFast = false;
	private ribbonUid = 0;
	private bounceAt = -1;
	private anticNext = 0;
	/* 手动偏航角(度):调试用,叠加在自旋时间线上,逐度检查旋转渲染 */
	private devYawDeg = 0;
	/* 注视 */
	private gaze = { x: 0, y: 0, tx: 0, ty: 0 };
	/* 身体跟随平滑值:滞后于 gaze.x,产生眼睛先动身体慢半拍的 follow-through */
	private leanCur = 0;

	/* 渲染缓存 */
	private curBodyColor = "";
	private confettiPieces: ConfettiPiece[] = [];
	private running = false;
	private clickHandler?: () => void;
	private onPetHandler?: () => void;
	private pointerMoveHandler?: (e: MouseEvent) => void;

	constructor(
		private el: HTMLElement,
		opts: MascotOptions,
	) {
		this.def = EMOTION_MAP.get(opts.emotion ?? DEFAULT_EMOTION_ID) ?? Mascot.FALLBACK;
		this.onPetHandler = opts.onPet;
		this.buildDOM();
		this.setEmotion(this.def.id);
		if (opts.onClick) {
			this.clickHandler = opts.onClick;
			this.svg.addEventListener("click", this.clickHandler);
		}
		this.initInteractions();
		if (opts.frozen) {
			this.renderStatic();
		} else {
			this.start();
		}
	}

	/* ----- 对外 SDK ----- */

	/**
	 * 切换表情并重锚时间轴:从当前姿态弹簧过渡到新表情 base。
	 *
	 * 触发表情的入场一次性动作(spin/confetti);frozen 实例重渲静态帧。
	 *
	 * @param id - 表情 ID;未知值回退待机
	 */
	setEmotion(id: string): void {
		const def = EMOTION_MAP.get(id) ?? Mascot.FALLBACK;
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
		if (def.confetti && this.running) this.burst(Math.round(20 * def.confetti));
	}

	/**
	 * 手动设置偏航角(度):调试通道,直接叠加在自旋结果上。
	 * 非运行实例重渲静态帧。
	 */
	setDevYaw(deg: number): void {
		this.devYawDeg = deg;
		if (!this.running) this.renderStatic();
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

	/**
	 * 触发摸头互动:飞机耳 + 头顶爱心,持续期内可重复触发。
	 *
	 * @param durationMs - 互动持续时间(毫秒),缺省 1200
	 */
	pet(durationMs = 1200): void {
		const now = performance.now();
		this.petUntil = Math.max(this.petUntil, now + durationMs);
		this.onPetHandler?.();
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

	/** 本次自旋的彩带轨道平面:随机倾角 + 随机基色相,一次自旋内所有彩带共享 */
	private makeRibbonPlane(): void {
		const base = rand(0, TAU);
		this.ribbonPlane = {
			tilt: rand(0.16, 0.5),
			roll: base + rand(-0.12, 0.12),
			count: Math.round(rand(3, 5)),
			baseHue: rand(0, 360),
		};
		this.ribbonSpawnIdx = 0;
	}

	/** 轨道点:绕身体中心 (130,147) 的倾斜圆轨道,z=cosλ·cos(tilt) 决定前后层 */
	private ribbonPoint(o: RibbonOrbit, lam: number): RibbonPoint {
		const hx = o.rad * Math.sin(lam);
		const hy = -o.rad * Math.cos(lam) * Math.sin(o.tilt);
		const ca = Math.cos(o.roll);
		const sa = Math.sin(o.roll);
		return {
			x: 130 + hx * ca - hy * sa,
			y: 147 + hx * sa + hy * ca,
			z: Math.cos(lam) * Math.cos(o.tilt),
			l: lam,
		};
	}

	private createRibbon(cfg: { o: RibbonOrbit; r: number; hue: number }): void {
		if (this.ribbons.length >= 8) return;
		this.ribbonUid++;
		const gradEl = this.mk("linearGradient", {
			id: `ribbon-grad-${this.uid}-${this.ribbonUid}`,
			gradientUnits: "userSpaceOnUse",
		}) as SVGElement;
		const stops: SVGStopElement[] = [];
		for (let s = 0; s < 5; s++) {
			const st = this.mk("stop", { offset: (s / 4).toFixed(3) }) as SVGStopElement;
			gradEl.appendChild(st);
			stops.push(st);
		}
		this.defsEl.appendChild(gradEl);
		const fill = `url(#ribbon-grad-${this.uid}-${this.ribbonUid})`;
		const back = this.mk("path", { fill, opacity: "0" }) as SVGPathElement;
		const front = this.mk("path", { fill, opacity: "0" }) as SVGPathElement;
		this.fxBackG.appendChild(back);
		this.fxLayer.appendChild(front);
		this.ribbons.push({
			o: cfg.o,
			hist: [],
			life: 0,
			ret: 0,
			r: cfg.r,
			hue: cfg.hue,
			hueSpan: rand(45, 95) * (Math.random() < 0.5 ? 1 : -1),
			hueVel: rand(18, 42) * (Math.random() < 0.5 ? 1 : -1),
			gradEl,
			stops,
			back,
			front,
		});
	}

	/** 自旋甩带:沿本次轨道平面错峰甩出,层间距随数量摊薄 */
	private spawnRibbon(lam0: number, dir: number): void {
		const pl = this.ribbonPlane;
		if (!pl) return;
		const tierStep = 36 / Math.max(pl.count - 1, 1);
		const rw = pl.count <= 3 ? rand(8, 10.5) : pl.count === 4 ? rand(6.6, 8.6) : rand(5.6, 7.4);
		this.createRibbon({
			o: {
				lam: lam0,
				lamVel: dir * rand(0.5, 1.1),
				tilt: pl.tilt + rand(-0.04, 0.04),
				roll: pl.roll + rand(-0.05, 0.05),
				rad: 110 + this.ribbonSpawnIdx * tierStep + rand(-1.5, 1.5),
				radVel: rand(0, 2.5),
				follow: rand(0.74, 0.94),
				carry: 0,
				arc: rand(2.2, 3.4),
			},
			r: rw,
			hue: pl.baseHue + (360 * this.ribbonSpawnIdx) / Math.max(pl.count, 1) + rand(-14, 14),
		});
		this.ribbonSpawnIdx++;
	}
	/** 拖尾轮廓:头宽尾细 + 圆头封口,按 z 正负拆前后段 */
	private ribbonOutline(pts: RibbonPoint[], width: number): { front: string; back: string } {
		const n = pts.length;
		if (n < 2) return { front: "", back: "" };
		const nx: number[] = [];
		const ny: number[] = [];
		for (let e = 0; e < n; e++) {
			const p0 = pts[e > 0 ? e - 1 : 0];
			const p1 = pts[e < n - 1 ? e + 1 : n - 1];
			let dx = p1.x - p0.x;
			let dy = p1.y - p0.y;
			const h = Math.hypot(dx, dy) || 1;
			dx /= h;
			dy /= h;
			const d = (width * (0.5 + (e / (n - 1)) * 0.5)) / 2;
			nx.push(-dy * d);
			ny.push(dx * d);
		}
		const cap = (idx: number) => {
			const hw = Math.max(Math.hypot(nx[idx], ny[idx]), 0.2);
			return `A${hw.toFixed(2)} ${hw.toFixed(2)} 0 0 0 `;
		};
		const seg = (a: number, b: number) => {
			let s = "";
			for (let k = a; k <= b; k++)
				s += `${k === a ? "M" : "L"}${(pts[k].x + nx[k]).toFixed(2)} ${(pts[k].y + ny[k]).toFixed(2)}`;
			s += b === n - 1 ? cap(b) : "L";
			for (let k = b; k >= a; k--)
				s += `${k === b ? "" : "L"}${(pts[k].x - nx[k]).toFixed(2)} ${(pts[k].y - ny[k]).toFixed(2)}`;
			if (a === 0)
				s += `${cap(0)}${(pts[0].x + nx[0]).toFixed(2)} ${(pts[0].y + ny[0]).toFixed(2)}`;
			return `${s}Z`;
		};
		let front = "";
		let back = "";
		let d0 = 0;
		while (d0 < n) {
			const isF = pts[d0].z >= 0;
			let i2 = d0;
			while (i2 + 1 < n && pts[i2 + 1].z >= 0 === isF) i2++;
			const a2 = Math.max(d0 - 1, 0);
			const b2 = Math.min(i2 + 1, n - 1);
			if (b2 > a2) {
				const str = seg(a2, b2);
				if (isF) front += str;
				else back += str;
			}
			d0 = i2 + 1;
		}
		return { front, back };
	}

	/** 彩带逐帧:跟随自旋转过身体、惯性衰减、smoothstep 回缩、色相漂移 */
	private stepRibbons(now: number, dt: number, yaw: number): void {
		const dYawRaw = yaw - this.ribbonPrevYaw;
		const dYaw = Number.isFinite(dYawRaw) && Math.abs(dYawRaw) <= 1.2 ? dYawRaw : 0;
		this.ribbonPrevYaw = yaw;
		const vel = dYaw / dt;
		const fast = Math.abs(vel) >= 0.9;
		const dir = vel >= 0 ? 1 : -1;

		if (fast && !this.ribbonWasFast) {
			this.makeRibbonPlane();
			this.ribbonSpawnAt = [];
			const cnt = this.ribbonPlane?.count ?? 0;
			for (let q = 0; q < cnt; q++) {
				this.ribbonSpawnAt.push(now + q * rand(55, 105));
			}
		}
		if (!fast) this.ribbonSpawnAt.length = 0;
		this.ribbonWasFast = fast;
		if (Math.abs(vel) >= 5) {
			while (this.ribbonSpawnAt.length && now >= this.ribbonSpawnAt[0]) {
				this.ribbonSpawnAt.shift();
				this.spawnRibbon(yaw - rand(0, 0.18) * dir, dir);
			}
		}

		for (let ti = this.ribbons.length - 1; ti >= 0; ti--) {
			const rb = this.ribbons[ti];
			const o = rb.o;
			rb.life += dt;
			const retract = !fast || rb.life > 5;
			rb.ret = clamp(rb.ret + (retract ? dt / 0.5 : -dt / 0.35), 0, 1);
			if (retract && rb.ret >= 1) {
				rb.back.remove();
				rb.front.remove();
				rb.gradEl.remove();
				this.ribbons.splice(ti, 1);
				continue;
			}
			if (fast) {
				o.carry = vel * o.follow;
				o.lam += dYaw * o.follow + o.lamVel * dt;
			} else {
				o.lam += (o.carry + o.lamVel) * dt;
				o.carry *= Math.exp(-2.6 * dt);
				o.lamVel *= Math.exp(-2.6 * dt);
			}
			o.rad += o.radVel * dt;

			const hist = rb.hist;
			const lastL = hist.length ? hist[hist.length - 1].l : o.lam - 0.001 * dir;
			const dl = o.lam - lastL;
			const steps = Math.min(Math.ceil(Math.abs(dl) / 0.09), 24);
			for (let st = 1; st <= steps; st++)
				hist.push(this.ribbonPoint(o, lastL + (dl * st) / steps));
			if (!hist.length) hist.push(this.ribbonPoint(o, o.lam));

			const span = o.arc * (1 - rb.ret * rb.ret * (3 - 2 * rb.ret));
			while (hist.length > 2 && Math.abs(o.lam - hist[0].l) > span) hist.shift();
			const over = Math.abs(o.lam - hist[0].l) - span;
			if (hist.length >= 2 && over > 0) {
				const tl = hist[0].l + (o.lam - hist[0].l >= 0 ? 1 : -1) * over;
				hist[0] = this.ribbonPoint(o, tl);
			}
			if (hist.length > 48) hist.splice(0, hist.length - 48);

			const zHead = Math.cos(o.lam) * Math.cos(o.tilt);
			const pz = 0.72 + 0.28 * clamp(zHead, 0, 1);
			let grow = Math.min(rb.life / 0.34, 1);
			grow = grow * grow * (3 - 2 * grow);
			const width = rb.r * pz * 1.7 * grow * (1 - 0.72 * rb.ret * rb.ret);
			const fade = Math.min(rb.life / 0.26, 1).toFixed(3);

			if (hist.length < 2 || width < 0.5) {
				rb.back.setAttribute("opacity", "0");
				rb.front.setAttribute("opacity", "0");
				continue;
			}
			const dstr = this.ribbonOutline(hist, width);
			rb.back.setAttribute("d", dstr.back);
			rb.front.setAttribute("d", dstr.front);
			rb.back.setAttribute("opacity", fade);
			rb.front.setAttribute("opacity", fade);

			const hue = rb.hue + rb.hueVel * rb.life;
			for (let si = 0; si < rb.stops.length; si++) {
				const frac = si / (rb.stops.length - 1);
				const hv = hue + frac * rb.hueSpan;
				rb.stops[si].setAttribute(
					"stop-color",
					`hsl(${(((hv % 360) + 360) % 360).toFixed(0)} 56% ${(56 + 11 * frac).toFixed(0)}%)`,
				);
			}
			const tail = hist[0];
			const headP = hist[hist.length - 1];
			rb.gradEl.setAttribute("x1", tail.x.toFixed(1));
			rb.gradEl.setAttribute("y1", tail.y.toFixed(1));
			rb.gradEl.setAttribute("x2", headP.x.toFixed(1));
			rb.gradEl.setAttribute("y2", headP.y.toFixed(1));
		}
	}
	/** 当前自旋偏航角 (rad);无自旋时为 0 */
	private spinYaw(now: number): number {
		const s = this.spin;
		if (!s) return 0;
		const u = clamp((now - s.start) / s.dur, 0, 1);
		return s.from + s.delta * easeInOutCubic(u);
	}

	/**
	 * 撒花庆祝:从身体中心向外爆开彩纸/星星。
	 *
	 * @param count - 目标粒子数,缺省 20;场上上限 60
	 */
	burst(count = 20): void {
		for (let i = 0; i < count && this.confettiPieces.length < 60; i++) {
			const ang = (i / count) * TAU + rand(-0.35, 0.35);
			const spd = rand(170, 360);
			const star = Math.random() < 0.18;
			const round = !star && Math.random() < 0.3;
			let node: SVGElement;
			if (star) {
				node = this.mk("path", { d: STAR_PATH, fill: "#F4C34E" });
			} else if (round) {
				node = this.mk("circle", {
					r: "1",
					fill: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
				});
			} else {
				node = this.mk("rect", {
					x: "-0.5",
					y: "-0.5",
					width: "1",
					height: "1",
					rx: "0.24",
					fill: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
				});
			}
			this.fxLayer.appendChild(node);
			this.confettiPieces.push({
				el: node,
				x: 130 + Math.cos(ang) * rand(80, 100),
				y: 130 + Math.sin(ang) * rand(80, 100),
				vx: Math.cos(ang) * spd,
				vy: Math.sin(ang) * spd - rand(20, 75),
				life: 0,
				max: rand(0.45, 0.85),
				r: star ? rand(4, 7) : rand(3.5, 8),
				rot: rand(0, 360),
				vr: rand(-260, 260),
				stretch: !star && !round ? 1.9 : 1,
			});
		}
		if (this.running && !rafId) {
			lastT = performance.now();
			rafId = requestAnimationFrame(loop);
		}
	}
	bounce(): void {
		if (this.bounceAt < 0) this.bounceAt = performance.now();
	}

	start(): void {
		if (this.destroyed || this.running) return;
		this.running = true;
		active.add(this);
		if (!rafId) {
			lastT = performance.now();
			rafId = requestAnimationFrame(loop);
		}
	}

	stop(): void {
		this.running = false;
		active.delete(this);
		if (active.size === 0 && rafId) {
			cancelAnimationFrame(rafId);
			rafId = 0;
		}
	}

	destroy(): void {
		this.stop();
		if (this.clickHandler) this.svg.removeEventListener("click", this.clickHandler);
		if (this.pointerMoveHandler)
			this.svg.removeEventListener("pointermove", this.pointerMoveHandler);
		this.svg.remove();
		this.destroyed = true;
	}

	/* ----- DOM 构建 ----- */

	private mk(tag: string, attrs: Record<string, string>): SVGElement {
		const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
		for (const k in attrs) e.setAttribute(k, attrs[k]);
		return e;
	}

	private initInteractions(): void {
		this.pointerMoveHandler = (e: MouseEvent) => {
			const rect = this.svg.getBoundingClientRect();
			if (!rect.width || !rect.height) return;
			// 转换为 0~260 viewBox 坐标
			const vx = ((e.clientX - rect.left) / rect.width) * 260;
			const vy = ((e.clientY - rect.top) / rect.height) * 260;

			// 检查是否在猫咪头部区域摸摸 (x in [75, 185], y in [30, 125])
			if (vx >= 75 && vx <= 185 && vy >= 30 && vy <= 125) {
				const dx = vx - this.lastPointerPos.x;
				const dy = vy - this.lastPointerPos.y;
				const dist = Math.hypot(dx, dy);
				this.petMoveDist += dist;
				const now = performance.now();
				if (this.petMoveDist > 35 && now - this.lastPetCheck > 250) {
					this.pet(900);
					this.petMoveDist = 0;
					this.lastPetCheck = now;
				}
			}
			this.lastPointerPos = { x: vx, y: vy };
		};
		this.svg.addEventListener("pointermove", this.pointerMoveHandler);
	}

	private buildDOM(): void {
		const svg = this.mk("svg", { viewBox: "0 0 260 260" }) as SVGSVGElement;
		svg.style.width = "100%";
		svg.style.height = "100%";
		svg.style.display = "block";
		svg.style.cursor = "pointer";
		// 粒子层溢出可见：confetti 从中心爆开后会飞出 viewBox，
		// 默认 overflow:hidden 会拦腰裁断烟花（宿主容器自行决定最终裁剪边界）
		svg.style.overflow = "visible";
		this.svg = svg;

		const defs = this.mk("defs", {});
		this.defsEl = defs;
		const gradId = `cat-body-grad-${this.uid}`;
		const grad = this.mk("radialGradient", {
			id: gradId,
			cx: "38%",
			cy: "32%",
			r: "70%",
		});
		this.bodyGrad = grad;
		this.gradStopA = this.mk("stop", {
			offset: "0%",
			"stop-color": "#FFFFFF",
		}) as SVGStopElement;
		this.gradStopB = this.mk("stop", {
			offset: "55%",
			"stop-color": PALETTE.body,
		}) as SVGStopElement;
		this.gradStopC = this.mk("stop", {
			offset: "100%",
			"stop-color": shade(PALETTE.body, -0.08),
		}) as SVGStopElement;
		grad.appendChild(this.gradStopA);
		grad.appendChild(this.gradStopB);
		grad.appendChild(this.gradStopC);
		defs.appendChild(grad);
		svg.appendChild(defs);

		// 地面软阴影
		this.shadowEl = this.mk("ellipse", {
			cx: "130",
			cy: "234",
			rx: "82",
			ry: "11",
			fill: "rgba(18, 14, 38, 0.4)",
		}) as SVGEllipseElement;
		svg.appendChild(this.shadowEl);

		// 思考环带
		this.haloG = this.mk("g", { opacity: "0" }) as SVGGElement;
		this.haloG.appendChild(
			this.mk("ellipse", {
				cx: "130",
				cy: "32",
				rx: "48",
				ry: "11",
				fill: "none",
				stroke: "#A78BFA",
				"stroke-width": "1.8",
				"stroke-dasharray": "4 8",
				opacity: "0.5",
				transform: "rotate(-6 130 32)",
			}),
		);
		for (let i = 0; i < 2; i++) {
			const dot = this.mk("circle", { r: "3.6", fill: "#8B5CF6" }) as SVGCircleElement;
			this.haloDots.push(dot);
			this.haloG.appendChild(dot);
		}
		svg.appendChild(this.haloG);

		// rig 容器
		this.rigG = this.mk("g", {}) as SVGGElement;

		// 尾巴 (身体后方)
		this.tailEl = this.mk("path", {
			d: catTailPath(0.5, 0.3),
			fill: "none",
			stroke: PALETTE.tail,
			"stroke-width": "12",
			"stroke-linecap": "round",
		}) as SVGPathElement;
		this.rigG.appendChild(this.tailEl);

		// 耳朵系统 (外耳 + 内耳粉嫩耳窝)
		this.earLG = this.mk("g", {}) as SVGGElement;
		this.earLOuter = this.mk("path", {
			d: CAT_EARS.left.outerD,
			fill: PALETTE.earOuter,
			stroke: PALETTE.bodyStroke,
			"stroke-width": "1.6",
		}) as SVGPathElement;
		this.earLInner = this.mk("path", {
			d: CAT_EARS.left.innerD,
			fill: PALETTE.earInner,
		}) as SVGPathElement;
		this.earLG.appendChild(this.earLOuter);
		this.earLG.appendChild(this.earLInner);
		this.rigG.appendChild(this.earLG);

		this.earRG = this.mk("g", {}) as SVGGElement;
		this.earROuter = this.mk("path", {
			d: CAT_EARS.right.outerD,
			fill: PALETTE.earOuter,
			stroke: PALETTE.bodyStroke,
			"stroke-width": "1.6",
		}) as SVGPathElement;
		this.earRInner = this.mk("path", {
			d: CAT_EARS.right.innerD,
			fill: PALETTE.earInner,
		}) as SVGPathElement;
		this.earRG.appendChild(this.earROuter);
		this.earRG.appendChild(this.earRInner);
		this.rigG.appendChild(this.earRG);

		// 猫猫面团身体
		this.bodyPath = this.mk("path", {
			d: smoothClosedPath(catMochiOutline()),
			fill: `url(#${gradId})`,
			stroke: PALETTE.bodyStroke,
			"stroke-width": "1.8",
		}) as SVGPathElement;
		this.rigG.appendChild(this.bodyPath);

		// 轻柔猫咪胡须 (左右各 2 根柔和微颤细须)
		this.whiskerLG = this.mk("g", { opacity: "0.55" }) as SVGGElement;
		this.whiskerLTop = this.mk("path", {
			d: CAT_WHISKERS.leftUpper,
			fill: "none",
			stroke: PALETTE.whisker,
			"stroke-width": "1.3",
			"stroke-linecap": "round",
		}) as SVGPathElement;
		this.whiskerLBot = this.mk("path", {
			d: CAT_WHISKERS.leftLower,
			fill: "none",
			stroke: PALETTE.whisker,
			"stroke-width": "1.3",
			"stroke-linecap": "round",
		}) as SVGPathElement;
		this.whiskerLG.appendChild(this.whiskerLTop);
		this.whiskerLG.appendChild(this.whiskerLBot);
		this.rigG.appendChild(this.whiskerLG);

		this.whiskerRG = this.mk("g", { opacity: "0.55" }) as SVGGElement;
		this.whiskerRTop = this.mk("path", {
			d: CAT_WHISKERS.rightUpper,
			fill: "none",
			stroke: PALETTE.whisker,
			"stroke-width": "1.3",
			"stroke-linecap": "round",
		}) as SVGPathElement;
		this.whiskerRBot = this.mk("path", {
			d: CAT_WHISKERS.rightLower,
			fill: "none",
			stroke: PALETTE.whisker,
			"stroke-width": "1.3",
			"stroke-linecap": "round",
		}) as SVGPathElement;
		this.whiskerRG.appendChild(this.whiskerRTop);
		this.whiskerRG.appendChild(this.whiskerRBot);
		this.rigG.appendChild(this.whiskerRG);

		// 软萌腮红
		this.blushL = this.mk("ellipse", {
			cx: String(FACE.blushL[0]),
			cy: String(FACE.blushL[1]),
			rx: "15",
			ry: "8",
			fill: PALETTE.blush,
			opacity: "0",
		}) as SVGEllipseElement;
		this.blushR = this.mk("ellipse", {
			cx: String(FACE.blushR[0]),
			cy: String(FACE.blushR[1]),
			rx: "15",
			ry: "8",
			fill: PALETTE.blush,
			opacity: "0",
		}) as SVGEllipseElement;
		this.rigG.appendChild(this.blushL);
		this.rigG.appendChild(this.blushR);

		// 眼睛系统 (含晶莹水润双高光点)
		this.eyeLG = this.mk("g", {}) as SVGGElement;
		this.eyeLNode = this.mk("path", { fill: PALETTE.eye }) as SVGPathElement;
		this.eyeLSparkleA = this.mk("circle", {
			cx: "-4.5",
			cy: "-4.5",
			r: "3.2",
			fill: PALETTE.eyeSparkle,
			opacity: "0.95",
		}) as SVGCircleElement;
		this.eyeLSparkleB = this.mk("circle", {
			cx: "4",
			cy: "3.5",
			r: "1.6",
			fill: PALETTE.eyeSparkle,
			opacity: "0.8",
		}) as SVGCircleElement;
		this.eyeLG.appendChild(this.eyeLNode);
		this.eyeLG.appendChild(this.eyeLSparkleA);
		this.eyeLG.appendChild(this.eyeLSparkleB);
		this.rigG.appendChild(this.eyeLG);

		this.eyeRG = this.mk("g", {}) as SVGGElement;
		this.eyeRNode = this.mk("path", { fill: PALETTE.eye }) as SVGPathElement;
		this.eyeRSparkleA = this.mk("circle", {
			cx: "-4.5",
			cy: "-4.5",
			r: "3.2",
			fill: PALETTE.eyeSparkle,
			opacity: "0.95",
		}) as SVGCircleElement;
		this.eyeRSparkleB = this.mk("circle", {
			cx: "4",
			cy: "3.5",
			r: "1.6",
			fill: PALETTE.eyeSparkle,
			opacity: "0.8",
		}) as SVGCircleElement;
		this.eyeRG.appendChild(this.eyeRNode);
		this.eyeRG.appendChild(this.eyeRSparkleA);
		this.eyeRG.appendChild(this.eyeRSparkleB);
		this.rigG.appendChild(this.eyeRG);

		// 猫咪小嘴系统 (多形态闭合腔/舌头/外轮廓)
		this.mouthG = this.mk("g", {}) as SVGGElement;
		this.mouthCavity = this.mk("path", {
			fill: PALETTE.mouthCavity,
			opacity: "0",
		}) as SVGPathElement;
		this.mouthTongue = this.mk("path", {
			fill: PALETTE.mouthTongue,
			opacity: "0",
		}) as SVGPathElement;
		this.mouthLine = this.mk("path", {
			d: MOUTH_SHAPES.w.lineD,
			fill: "none",
			stroke: PALETTE.mouth,
			"stroke-width": "1.6",
			"stroke-linecap": "round",
			"stroke-linejoin": "round",
		}) as SVGPathElement;
		this.mouthG.appendChild(this.mouthCavity);
		this.mouthG.appendChild(this.mouthTongue);
		this.mouthG.appendChild(this.mouthLine);
		this.rigG.appendChild(this.mouthG);

		// 胸前小爪爪 (带粉嫩主肉垫 + 3 颗小趾肉球 Toe Beans)
		this.pawLG = this.mk("g", {}) as SVGGElement;
		this.pawLG.appendChild(
			this.mk("ellipse", {
				cx: String(FACE.pawL[0]),
				cy: String(FACE.pawL[1]),
				rx: "13",
				ry: "9",
				fill: PALETTE.paw,
				stroke: PALETTE.bodyStroke,
				"stroke-width": "1.2",
			}),
		);
		this.pawLG.appendChild(
			this.mk("ellipse", {
				cx: String(FACE.pawL[0]),
				cy: String(FACE.pawL[1] + 1.2),
				rx: "5.5",
				ry: "3.8",
				fill: PALETTE.pawPad,
			}),
		);
		this.pawLG.appendChild(
			this.mk("circle", {
				cx: String(FACE.pawL[0] - 5),
				cy: String(FACE.pawL[1] - 4.5),
				r: "1.6",
				fill: PALETTE.pawBean,
			}),
		);
		this.pawLG.appendChild(
			this.mk("circle", {
				cx: String(FACE.pawL[0]),
				cy: String(FACE.pawL[1] - 6.2),
				r: "1.7",
				fill: PALETTE.pawBean,
			}),
		);
		this.pawLG.appendChild(
			this.mk("circle", {
				cx: String(FACE.pawL[0] + 5),
				cy: String(FACE.pawL[1] - 4.5),
				r: "1.6",
				fill: PALETTE.pawBean,
			}),
		);
		this.rigG.appendChild(this.pawLG);

		this.pawRG = this.mk("g", {}) as SVGGElement;
		this.pawRG.appendChild(
			this.mk("ellipse", {
				cx: String(FACE.pawR[0]),
				cy: String(FACE.pawR[1]),
				rx: "13",
				ry: "9",
				fill: PALETTE.paw,
				stroke: PALETTE.bodyStroke,
				"stroke-width": "1.2",
			}),
		);
		this.pawRG.appendChild(
			this.mk("ellipse", {
				cx: String(FACE.pawR[0]),
				cy: String(FACE.pawR[1] + 1.2),
				rx: "5.5",
				ry: "3.8",
				fill: PALETTE.pawPad,
			}),
		);
		this.pawRG.appendChild(
			this.mk("circle", {
				cx: String(FACE.pawR[0] - 5),
				cy: String(FACE.pawR[1] - 4.5),
				r: "1.6",
				fill: PALETTE.pawBean,
			}),
		);
		this.pawRG.appendChild(
			this.mk("circle", {
				cx: String(FACE.pawR[0]),
				cy: String(FACE.pawR[1] - 6.2),
				r: "1.7",
				fill: PALETTE.pawBean,
			}),
		);
		this.pawRG.appendChild(
			this.mk("circle", {
				cx: String(FACE.pawR[0] + 5),
				cy: String(FACE.pawR[1] - 4.5),
				r: "1.6",
				fill: PALETTE.pawBean,
			}),
		);
		this.rigG.appendChild(this.pawRG);

		// 彩带后层:先于 rig 挂载,轨道绕到身体背面的段被身体遮挡
		this.fxBackG = this.mk("g", { "pointer-events": "none" }) as SVGGElement;
		svg.appendChild(this.fxBackG);
		svg.appendChild(this.rigG);

		// 睡眠 zzz
		for (let i = 0; i < 3; i++) {
			const z = this.mk("text", {
				x: "0",
				y: "0",
				"font-size": "13",
				fill: "#A78BFA",
				"font-weight": "700",
				"font-style": "italic",
				"text-anchor": "middle",
				opacity: "0",
			}) as SVGTextElement;
			z.textContent = "z";
			this.zzzEls.push(z);
			svg.appendChild(z);
		}

		this.fxLayer = this.mk("g", { "pointer-events": "none" }) as SVGGElement;
		svg.appendChild(this.fxLayer);

		this.el.appendChild(svg);
	}

	/* ----- 内部驱动 ----- */

	private seq: {
		frames: SequenceFrame[];
		settle: "base" | "hold" | { next: string };
		done: boolean;
	} | null = null;

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

	tick(now: number, dt: number): void {
		if (this.destroyed) return;
		this.lastPose = this.compose(now, dt);
		this.render(this.lastPose, now, dt);
	}

	private renderStatic(): void {
		this.transDur = 0;
		this.ringSpring.x = 1;
		this.ringSpring.v = 0;
		this.openSpring.x = this.def.openness ?? 1;
		this.openSpring.v = 0;
		const seq = this.seq;
		this.seq = null;
		this.tick(performance.now(), 1 / 60);
		this.seq = seq;
	}

	private compose(now: number, dt: number): Pose {
		const def = this.def;
		const t = now - this.emoStart;
		let pose: Pose | null = null;

		if (this.seq) {
			const res = this.seqPose(t, now);
			if (res === "switch") {
				return this.compose(now, dt);
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

		if (this.running && now >= this.poolNext) {
			if (def.pool.length > 1 && !def.pair) {
				this.poolPos =
					(this.poolPos + 1 + Math.floor(rand(0, def.pool.length - 1))) % def.pool.length;
				this.setRing(this.poolRing(this.poolPos), def.poolSpeed ?? 6);
			}
			this.poolNext =
				now + rand((def.poolMs ?? [9000, 16000])[0], (def.poolMs ?? [9000, 16000])[1]);
		}

		if (this.running && def.blinkMs && now >= this.blinkNext) {
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

		if (this.running && def.antics && now >= this.anticNext) {
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

		// 摸摸头抚摸状态覆盖 (Petting Feedback)
		if (this.running && now < this.petUntil) {
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
		return pose;
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
					this.setEmotion(seq.settle.next);
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

	/* ----- 渲染 ----- */

	private render(pose: Pose, now: number, dt: number): void {
		const b = pose.body;
		// 身体 rig:中心 130,贴地 226
		const cx = 130;
		const anchorY = 226;

		// 3D 偏航角计算 (自旋 yaw + 视线 lookX 转换为弧度制偏角)
		const avgLookX = (pose.left.lookX + pose.right.lookX) * 0.5;
		const avgLookY = (pose.left.lookY + pose.right.lookY) * 0.5;
		const phi = pose.yaw + avgLookX / 75;
		const pitchY = avgLookY * 0.65;
		// 整脸透明度:随偏航提早下降,配合位置滑动读出侧面
		const faceOp = clamp((Math.cos(pose.yaw) - 0.2) / 0.5, 0, 1);
		// 统一球面投影:全部部件共用 FACE_R 与同一条投影曲线;θ0 为部件本体经度
		// (正面锚点经 thetaOf 换算,背面部件如尾巴根直接给显式经度),
		// 位置/压缩/淡出三通道同源,构成刚体式整猫旋转
		const thetaOf = (x0: number) => Math.asin(clamp((x0 - 130) / FACE_R, -1, 1));
		const faceProj = (theta0: number, a: number) => {
			const p = theta0 + a;
			const nz = Math.cos(p);
			return {
				x: 130 + FACE_R * Math.sin(p),
				sx: clamp(nz, 0.02, 1),
				op: clamp(nz / 0.16, 0, 1),
			};
		};

		// 身体注视跟随(次级动作):仅指针注意力(gaze.x)驱动——avgLookX 还混有微漂移与
		// 表情 lookX 动画(scan 类),直接用会连带身体摇摆。独立慢平滑让身体比眼睛
		// 慢半拍跟上,产生 follow-through 而非刚体同进同退
		this.leanCur += (this.gaze.x - this.leanCur) * (1 - Math.exp(-GAZE_LEAN_K * dt));
		const leanShift = this.leanCur * GAZE_LEAN_SHIFT;
		const leanRot = this.leanCur * GAZE_LEAN_ROT;

		// 身体 rig:中心 130,贴地 226。偏航横向压缩已由 faceProj 统一驱动五官,
		// rigG 不再做 yaw 压缩——否则五官(faceProj.sx)和身体(yawSquash)双重压缩,
		// 各部件因 theta0 不同受到不同程度叠加,旋转时"各自为伍"。
		// 仅保留注视跟随的微量 lean 压缩(身体看向一侧时轻微收窄,幅度极小)
		const leanSquash = 1 - GAZE_LEAN_SQUASH * (Math.abs(this.leanCur) / GAZE_X);
		this.rigG.setAttribute(
			"transform",
			[
				`translate(${(cx + b.x + leanShift).toFixed(2)} ${(anchorY + b.y).toFixed(2)})`,
				`rotate(${(b.rotate + leanRot).toFixed(2)})`,
				`scale(${(b.scale * leanSquash).toFixed(4)} ${(b.scale * b.stretchY).toFixed(4)})`,
				`translate(${(-cx).toFixed(2)} ${(-anchorY).toFixed(2)})`,
			].join(" "),
		);

		// 地面投影随跳起高度缩小变淡(b.y 负为升空),随偏航与注视跟随微移增强立体感
		const shadowScale = clamp(b.scale * (1 + b.y * 0.008), 0.5, 1.4);
		this.shadowEl.setAttribute(
			"transform",
			`translate(${(cx + b.x * 0.4 + Math.sin(phi) * 7 + leanShift * 0.5).toFixed(2)} 234) scale(${shadowScale.toFixed(3)}) translate(${-cx} -234)`,
		);
		this.shadowEl.setAttribute("opacity", clamp(1 + b.y * 0.01, 0.45, 1).toFixed(3));

		// 身体变色与高光梯度
		if (b.color !== this.curBodyColor) {
			this.curBodyColor = b.color;
			this.gradStopA.setAttribute("stop-color", shade(b.color, 0.25));
			this.gradStopB.setAttribute("stop-color", b.color);
			this.gradStopC.setAttribute("stop-color", shade(b.color, -0.1));
			this.earLOuter.setAttribute("fill", shade(b.color, -0.04));
			this.earROuter.setAttribute("fill", shade(b.color, -0.04));
			this.tailEl.setAttribute("stroke", shade(b.color, -0.06));
		}

		const gradCx = `${(38 + 14 * Math.sin(phi)).toFixed(1)}%`;
		const gradCy = `${(32 + 6 * Math.sin(phi * 2) - pitchY * 0.1).toFixed(1)}%`;
		this.bodyGrad.setAttribute("cx", gradCx);
		this.bodyGrad.setAttribute("cy", gradCy);

		// 尾巴 3D 环绕与摆动(投影半径与面部统一,刚体旋转)
		const tailSway = Math.sin((TAU * now) / 2400) * b.tail;
		this.tailEl.setAttribute("d", catTailPath(tailSway, b.tailElev, phi, FACE_R));
		// 猫耳:统一球面投影(锚点为耳 pivot),背面交换位置;内耳淡出走同一条投影曲线
		const earL = faceProj(thetaOf(CAT_EARS.left.pivot[0]), phi);
		const earR = faceProj(thetaOf(CAT_EARS.right.pivot[0]), phi);
		const earLDx = earL.x - CAT_EARS.left.pivot[0];
		const earRDx = earR.x - CAT_EARS.right.pivot[0];
		const earLRot = b.earL + Math.sin((TAU * now) / 3200) * 1.5 - avgLookX * 0.1;
		const earRRot = b.earR - Math.sin((TAU * now) / 3200 + 0.4) * 1.5 - avgLookX * 0.1;

		this.earLG.setAttribute(
			"transform",
			`translate(${earLDx.toFixed(2)} 0) rotate(${earLRot.toFixed(2)} ${CAT_EARS.left.pivot[0]} ${CAT_EARS.left.pivot[1]})`,
		);
		this.earRG.setAttribute(
			"transform",
			`translate(${earRDx.toFixed(2)} 0) rotate(${earRRot.toFixed(2)} ${CAT_EARS.right.pivot[0]} ${CAT_EARS.right.pivot[1]})`,
		);

		// 粉嫩内耳窝淡出(与全脸同一条投影曲线,正面显示背面只露外耳毛色)
		this.earLInner.setAttribute("opacity", earL.op.toFixed(3));
		this.earRInner.setAttribute("opacity", earR.op.toFixed(3));

		// 左右眼:统一投影,锚点为 FACE 眼位
		const eL = faceProj(thetaOf(FACE.eyeL[0]), phi);
		const eR = faceProj(thetaOf(FACE.eyeR[0]), phi);
		const eyeLX = eL.x + pose.left.x + pose.left.lookX * 0.2;
		const eyeRX = eR.x + pose.right.x + pose.right.lookX * 0.2;
		const eyeLY = 142 + pitchY + pose.left.y;
		const eyeRY = 142 + pitchY + pose.right.y;

		this.renderEye(
			this.eyeLG,
			this.eyeLNode,
			this.eyeLSparkleA,
			this.eyeLSparkleB,
			pose.left,
			eyeLX,
			eyeLY,
			eL.sx,
			eL.op * faceOp,
		);
		this.renderEye(
			this.eyeRG,
			this.eyeRNode,
			this.eyeRSparkleA,
			this.eyeRSparkleB,
			pose.right,
			eyeRX,
			eyeRY,
			eR.sx,
			eR.op * faceOp,
		);

		// 猫咪小嘴:统一投影,锚点 130
		const m = faceProj(0, phi);
		const mouthY = 142 + pitchY + 14 + b.mouthY;
		this.renderMouth(b, m.x, mouthY, (b.mouthScale ?? 1) * m.sx, m.op * faceOp);

		// 腮红:统一投影,锚点为 FACE 腮红位,几何恒定
		const bl = faceProj(thetaOf(FACE.blushL[0]), phi);
		const br = faceProj(thetaOf(FACE.blushR[0]), phi);
		const blushY = 162 + pitchY * 0.85;
		const blushR0 = 15;

		this.blushL.setAttribute("cx", bl.x.toFixed(2));
		this.blushL.setAttribute("cy", blushY.toFixed(2));
		this.blushL.setAttribute("rx", blushR0.toFixed(2));
		this.blushL.setAttribute("opacity", (b.blush * bl.op * faceOp).toFixed(3));

		this.blushR.setAttribute("cx", br.x.toFixed(2));
		this.blushR.setAttribute("cy", blushY.toFixed(2));
		this.blushR.setAttribute("rx", blushR0.toFixed(2));
		this.blushR.setAttribute("opacity", (b.blush * br.op * faceOp).toFixed(3));

		// 轻柔猫咪胡须:统一投影,锚点为 FACE 胡须位;wobble 微颤保留
		const wl = faceProj(thetaOf(FACE.whiskerL[0]), phi);
		const wr = faceProj(thetaOf(FACE.whiskerR[0]), phi);
		const whiskerWobble = Math.sin((TAU * now) / 2800) * 1.2;
		const whiskerBaseOp = b.whiskers * 0.55;

		this.whiskerLG.setAttribute("opacity", (whiskerBaseOp * wl.op * faceOp).toFixed(3));
		this.whiskerRG.setAttribute("opacity", (whiskerBaseOp * wr.op * faceOp).toFixed(3));

		this.whiskerLG.setAttribute(
			"transform",
			`translate(${(wl.x - FACE.whiskerL[0]).toFixed(2)} ${pitchY.toFixed(2)}) ` +
				`rotate(${whiskerWobble.toFixed(2)} ${FACE.whiskerL[0]} ${FACE.whiskerL[1]}) scale(${wl.sx.toFixed(3)} 1)`,
		);
		this.whiskerRG.setAttribute(
			"transform",
			`translate(${(wr.x - FACE.whiskerR[0]).toFixed(2)} ${pitchY.toFixed(2)}) ` +
				`rotate(${(-whiskerWobble).toFixed(2)} ${FACE.whiskerR[0]} ${FACE.whiskerR[1]}) scale(${wr.sx.toFixed(3)} 1)`,
		);
		// 左右前爪:统一投影,锚点为 FACE 爪位
		const pl = faceProj(thetaOf(FACE.pawL[0]), phi);
		const pr = faceProj(thetaOf(FACE.pawR[0]), phi);

		this.pawLG.setAttribute("opacity", (pl.op * faceOp).toFixed(3));
		this.pawRG.setAttribute("opacity", (pr.op * faceOp).toFixed(3));

		this.pawLG.setAttribute(
			"transform",
			`translate(${(FACE.pawL[0] + b.pawLX + (pl.x - FACE.pawL[0])).toFixed(2)} ${(FACE.pawL[1] + b.pawY + b.pawLY).toFixed(2)}) ` +
				`rotate(${b.pawLRot.toFixed(2)}) scale(${(b.pawLScale * pl.sx).toFixed(3)} ${b.pawLScale.toFixed(3)}) ` +
				`translate(${-FACE.pawL[0]} ${-FACE.pawL[1]})`,
		);
		this.pawRG.setAttribute(
			"transform",
			`translate(${(FACE.pawR[0] + b.pawRX + (pr.x - FACE.pawR[0])).toFixed(2)} ${(FACE.pawR[1] + b.pawY + b.pawRY).toFixed(2)}) ` +
				`rotate(${b.pawRRot.toFixed(2)}) scale(${(b.pawRScale * pr.sx).toFixed(3)} ${b.pawRScale.toFixed(3)}) ` +
				`translate(${-FACE.pawR[0]} ${-FACE.pawR[1]})`,
		);

		// 思考光环
		this.haloG.setAttribute("opacity", b.halo > 0 ? "1" : "0");
		if (b.halo > 0) {
			const speed = (this.def.poolMs?.[0] ?? 2000) < 600 ? 2.6 : 1.4;
			const ang = (now / 1000) * speed;
			for (let i = 0; i < this.haloDots.length; i++) {
				const a = ang + i * Math.PI;
				this.haloDots[i].setAttribute("cx", (130 + 48 * Math.cos(a)).toFixed(2));
				this.haloDots[i].setAttribute("cy", (32 + 11 * Math.sin(a)).toFixed(2));
			}
		}

		// zzz 睡眠粒子
		const zOn = b.zzz > 0;
		for (let i = 0; i < this.zzzEls.length; i++) {
			const z = this.zzzEls[i];
			if (!zOn) {
				if (z.getAttribute("opacity") !== "0") z.setAttribute("opacity", "0");
				continue;
			}
			const zp = (now * 0.00033 + i / 3) % 1;
			const zo = (zp < 0.18 ? zp / 0.18 : 1 - (zp - 0.18) / 0.82) * 0.8 * b.zzz;
			z.setAttribute("opacity", zo.toFixed(3));
			z.setAttribute("font-size", (12 + zp * 11).toFixed(1));
			z.setAttribute(
				"transform",
				`translate(${(182 + zp * 34 + 4 * Math.sin(zp * 9)).toFixed(2)} ${(44 - zp * 42).toFixed(2)}) rotate(${(-10 + zp * 14).toFixed(1)})`,
			);
		}

		this.stepRibbons(now, dt, pose.yaw);
		this.stepConfetti(dt);
	}

	private renderMouth(
		b: BodyState,
		mx: number,
		my: number,
		persScaleX: number,
		opacity: number,
	): void {
		if (opacity <= 0.01) {
			this.mouthG.style.display = "none";
			return;
		}
		this.mouthG.style.display = "";
		this.mouthG.setAttribute("opacity", opacity.toFixed(3));

		const shapeId = b.mouth ?? "w";
		if (shapeId !== this.curMouthShape) {
			this.curMouthShape = shapeId;
			const geom = MOUTH_SHAPES[shapeId] ?? MOUTH_SHAPES.w;
			this.mouthLine.setAttribute("d", geom.lineD);
			if (geom.fillD) {
				this.mouthCavity.setAttribute("d", geom.fillD);
				this.mouthCavity.setAttribute("opacity", "1");
			} else {
				this.mouthCavity.setAttribute("opacity", "0");
			}
			if (geom.tongueD) {
				this.mouthTongue.setAttribute("d", geom.tongueD);
				this.mouthTongue.setAttribute("opacity", "1");
			} else {
				this.mouthTongue.setAttribute("opacity", "0");
			}
		}

		const ms = b.mouthScale ?? 1;
		this.mouthG.setAttribute(
			"transform",
			`translate(${mx.toFixed(2)} ${my.toFixed(2)}) scale(${persScaleX.toFixed(3)} ${ms.toFixed(3)}) translate(${-130} ${-156})`,
		);
	}

	private renderEye(
		eyeG: SVGGElement,
		node: SVGPathElement,
		sparkleA: SVGCircleElement,
		sparkleB: SVGCircleElement,
		eye: EyeState,
		targetX: number,
		targetY: number,
		cn: number,
		opacity: number,
	): void {
		const ring = eye.ring ?? EYE_RINGS.round;
		if (ring !== (node as unknown as { __ring?: EyeRing }).__ring) {
			(node as unknown as { __ring?: EyeRing }).__ring = ring;
			// 归一化轮廓点乘以眼半径,并缓存谷底半径(高光内收用)
			let rMin = Number.POSITIVE_INFINITY;
			const scaled: [number, number][] = [];
			for (const p of ring) {
				const x = p[0] * FACE.eyeRadius;
				const y = p[1] * FACE.eyeRadius;
				scaled.push([x, y]);
				rMin = Math.min(rMin, Math.hypot(x, y));
			}
			(node as unknown as { __rMin?: number }).__rMin = rMin;
			node.setAttribute("d", smoothClosedPath(scaled));
		}

		if (cn <= 0.02 || opacity <= 0.01) {
			eyeG.style.display = "none";
			return;
		}
		eyeG.style.display = "";
		eyeG.setAttribute("opacity", opacity.toFixed(3));

		const open = clamp(eye.open, 0.02, 2.4);
		const sy = clamp(eye.scaleY * open, 0.02, 2.4);
		const sx = clamp(eye.scaleX * cn, 0.02, 2.4);

		eyeG.setAttribute(
			"transform",
			`translate(${targetX.toFixed(2)} ${targetY.toFixed(2)})` +
				(eye.rotate ? ` rotate(${eye.rotate.toFixed(1)})` : "") +
				` scale(${sx.toFixed(3)} ${sy.toFixed(3)})`,
		);

		// 高光晶莹度 (Catchlight Sparkle)
		const sparkleOp = clamp((open - 0.28) / 0.5, 0, 1);
		sparkleA.setAttribute("opacity", (0.95 * sparkleOp).toFixed(3));
		sparkleB.setAttribute("opacity", (0.75 * sparkleOp).toFixed(3));
		// 高光视差漂移;窄谷眼环(星形/月牙)内收防贴边出界
		const spx = eye.lookX * 0.12;
		const spy = eye.lookY * 0.12;
		const rMin = (node as unknown as { __rMin?: number }).__rMin ?? FACE.eyeRadius;
		const pull = (x: number, y: number, cap: number): [number, number] => {
			const r = Math.hypot(x, y);
			return r > cap ? [(x / r) * cap, (y / r) * cap] : [x, y];
		};
		const [ax, ay] = pull(-4.5 + spx, -4.5 + spy, rMin * 0.6);
		const [bx, by] = pull(4.0 + spx * 0.6, 3.5 + spy * 0.6, rMin * 0.55);
		// 高光抵抗透视压扁:水平向反向缩放抵消眼形的 cn 压缩,保持正圆;
		// 垂直向保留压缩(眼睑压光的物理语义)
		const inv = 1 / Math.max(sx, 0.3);
		sparkleA.setAttribute("cx", ax.toFixed(2));
		sparkleA.setAttribute("cy", ay.toFixed(2));
		sparkleA.setAttribute("transform", `scale(${inv.toFixed(3)} 1)`);
		sparkleB.setAttribute("cx", bx.toFixed(2));
		sparkleB.setAttribute("cy", by.toFixed(2));
		sparkleB.setAttribute("transform", `scale(${inv.toFixed(3)} 1)`);
	}

	private stepConfetti(dt: number): void {
		if (!this.confettiPieces.length) return;
		for (let i = this.confettiPieces.length - 1; i >= 0; i--) {
			const p = this.confettiPieces[i];
			p.life += dt;
			if (p.life >= p.max) {
				p.el.remove();
				this.confettiPieces.splice(i, 1);
				continue;
			}
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			const drag = 0.94 ** (60 * dt);
			p.vx *= drag;
			p.vy = p.vy * drag + 40 * dt;
			p.rot += p.vr * dt;
			const u = p.life / p.max;
			const fd = u < 0.1 ? u / 0.1 : (1 - (u - 0.1) / 0.9) ** 1.7;
			const sz = Math.max(p.r * (1 - 0.4 * u), 0.5);
			p.el.setAttribute("opacity", fd.toFixed(3));
			p.el.setAttribute(
				"transform",
				`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.rot.toFixed(1)}) scale(${sz.toFixed(2)} ${(sz * p.stretch).toFixed(2)})`,
			);
		}
	}
}
