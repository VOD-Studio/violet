/**
 * Mascot 引擎 —— 软萌猫猫团 (Cat-Mochi) 渲染与物理状态机。
 *
 * 核心架构：
 *   - 渲染层：带质感径向渐变、地底软阴影、灵动猫耳系统 (外耳+内耳耳窝, 独立支点旋转)、
 *     摇曳尾巴、胸前肉垫小爪爪、腮红、球面投影眼环。
 *   - 物理与姿态：pose 合成 (base/sequence/anims/过渡)、临界阻尼弹簧、眨眼关键帧过冲、
 *     眼神微漂移、自旋 yaw 球面投影、4 段衰减弹跳、antics 待机小动作。
 */
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
import {
	type Anim,
	type BodyPose,
	DEFAULT_EMOTION_ID,
	EMOTION_MAP,
	EMOTIONS,
	type EmotionDef,
	type EyePose,
	PALETTE,
	type SequenceFrame,
} from "./expressions";
import { EYE_RINGS, type EyeRing } from "./eyes";

export interface MascotOptions {
	emotion?: string;
	frozen?: boolean;
	onClick?: () => void;
	onPet?: () => void;
}

const TAU = Math.PI * 2;
/** 注视幅度(viewBox 像素):横 24 纵 15 */
const GAZE_X = 24;
const GAZE_Y = 15;
/** 单圈自旋时长 (ms):时间线驱动,角速度均匀、起止缓动 */
const SPIN_TURN_MS = 850;
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

/* ---------- 工具 ---------- */

function clamp(v: number, a: number, b: number): number {
	return v < a ? a : v > b ? b : v;
}
function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}
function rand(a: number, b: number): number {
	return a + Math.random() * (b - a);
}
function easeInOutCubic(t: number): number {
	return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
function hexToRgb(hex: string): [number, number, number] {
	const n = Number.parseInt(hex.replace("#", ""), 16);
	if (hex.length <= 4) {
		const r = (n >> 8) & 0xf;
		const g = (n >> 4) & 0xf;
		const b = n & 0xf;
		return [(r << 4) | r, (g << 4) | g, (b << 4) | b];
	}
	return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}
function rgbToHex(c: readonly [number, number, number]): string {
	return `#${c.map((x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, "0")).join("")}`;
}
function shade(hex: string, amt: number): string {
	const rgb = hexToRgb(hex);
	return rgbToHex(
		rgb.map((c) => clamp(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt), 0, 255)) as [
			number,
			number,
			number,
		],
	);
}
function lerpColor(a: string, b: string, t: number): string {
	const ra = hexToRgb(a);
	const rb = hexToRgb(b);
	return rgbToHex([lerp(ra[0], rb[0], t), lerp(ra[1], rb[1], t), lerp(ra[2], rb[2], t)]);
}

/** 临界阻尼弹簧 */
interface Spring {
	x: number;
	v: number;
	t: number;
}
function spring(v0: number): Spring {
	return { x: v0, v: 0, t: v0 };
}
function springStep(s: Spring, w: number, z: number, dt: number): void {
	const d = s.x - s.t;
	const ww = w * w;
	const f = -ww * d - 2 * z * w * s.v;
	s.v += f * dt;
	s.x += s.v * dt;
}

function lerpRing(a: EyeRing, b: EyeRing, t: number): [number, number][] {
	const out: [number, number][] = new Array(a.length);
	for (let i = 0; i < a.length; i++) {
		out[i] = [a[i][0] + (b[i][0] - a[i][0]) * t, a[i][1] + (b[i][1] - a[i][1]) * t];
	}
	return out;
}

/* ---------- Pose 系统 ---------- */

interface BodyState {
	x: number;
	y: number;
	scale: number;
	rotate: number;
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
interface EyeState {
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
interface Pose {
	body: BodyState;
	left: EyeState;
	right: EyeState;
	yaw: number;
}

const DEFAULT_BODY: BodyState = {
	x: 0,
	y: 0,
	scale: 1,
	rotate: 0,
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
const DEFAULT_EYE: EyeState = {
	x: 0,
	y: 0,
	scaleX: 1,
	scaleY: 1,
	rotate: 0,
	open: 1,
	lookX: 0,
	lookY: 0,
};

function defaultPose(): Pose {
	return {
		body: { ...DEFAULT_BODY },
		left: { ...DEFAULT_EYE },
		right: { ...DEFAULT_EYE },
		yaw: 0,
	};
}
function clonePose(p: Pose): Pose {
	return { body: { ...p.body }, left: { ...p.left }, right: { ...p.right }, yaw: p.yaw };
}

function applySpec(
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

function lerpPose(a: Pose, b: Pose, t: number): Pose {
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

/** anim 原语 */
function animValue(anim: Anim, t: number, seed: number): number {
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

function applyAnim(pose: Pose, anim: Anim, t: number, seed: number): void {
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
	private bounceAt = -1;
	private anticNext = 0;
	/* 注视 */
	private gaze = { x: 0, y: 0, tx: 0, ty: 0 };

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
		if (!this.running) this.renderStatic();
	}

	setGaze(nx: number, ny: number): void {
		this.gaze.tx = clamp(nx, -1, 1) * GAZE_X;
		this.gaze.ty = clamp(ny, -1, 1) * GAZE_Y;
	}

	/** 摸摸头互动 (Petting) */
	pet(durationMs = 1200): void {
		const now = performance.now();
		this.petUntil = Math.max(this.petUntil, now + durationMs);
		this.onPetHandler?.();
	}

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

	/** 当前自旋偏航角 (rad);无自旋时为 0 */
	private spinYaw(now: number): number {
		const s = this.spin;
		if (!s) return 0;
		const u = clamp((now - s.start) / s.dur, 0, 1);
		return s.from + s.delta * easeInOutCubic(u);
	}

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
		pose.yaw = this.spinYaw(now);
		if (this.spin) {
			// 自旋时面团轻微起跳与弹性拉伸
			const spinProg = clamp((now - this.spin.start) / this.spin.dur, 0, 1);
			const hop = Math.sin(Math.PI * spinProg);
			pose.body.y += -hop * 10;
			pose.body.scale += hop * 0.04;
			if (spinProg >= 1) this.spin = null;
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
		// 脸部正面化:五官只随注视微移,不随自旋 yaw 滑动
		const facePhi = avgLookX / 75;
		// 整脸统一淡出:转过侧面时脸渐隐、背面隐藏,杜绝「单眼+错位嘴」的残缺中间帧
		const faceOp = clamp((Math.cos(pose.yaw) - 0.02) / 0.55, 0, 1);

		// 身体 rig:中心 130,贴地 226;水平压缩模拟转身收窄 (正面全宽,侧面 ~0.8)
		const yawSquash = 1 - 0.2 * (1 - Math.abs(Math.cos(phi)));
		this.rigG.setAttribute(
			"transform",
			[
				`translate(${(cx + b.x).toFixed(2)} ${(anchorY + b.y).toFixed(2)})`,
				`rotate(${b.rotate.toFixed(2)})`,
				`scale(${(b.scale * yawSquash).toFixed(4)} ${b.scale.toFixed(4)})`,
				`translate(${(-cx).toFixed(2)} ${(-anchorY).toFixed(2)})`,
			].join(" "),
		);

		// 地面投影随呼吸与弹跳缩放,并随偏航微移增强转身立体感
		const shadowScale = clamp(b.scale * (1 - b.y * 0.008), 0.5, 1.4);
		this.shadowEl.setAttribute(
			"transform",
			`translate(${(cx + b.x * 0.4 + Math.sin(phi) * 7).toFixed(2)} 234) scale(${shadowScale.toFixed(3)}) translate(${-cx} -234)`,
		);

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

		// 尾巴 3D 环绕与摆动
		const tailSway = Math.sin((TAU * now) / 2400) * b.tail;
		this.tailEl.setAttribute("d", catTailPath(tailSway, b.tailElev, phi));

		// 猫耳旋转系统与 3D 视差 (围绕 pivot 支点，背向时内耳粉色耳窝淡出)
		const earLPhi = -0.65 + phi;
		const earRPhi = 0.65 + phi;
		const earL_Nz = Math.cos(earLPhi);
		const earR_Nz = Math.cos(earRPhi);

		const earLDx = 16 * Math.sin(earLPhi) - 16 * Math.sin(-0.65);
		const earRDx = 16 * Math.sin(earRPhi) - 16 * Math.sin(0.65);
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

		// 粉嫩内耳窝在背面时淡出 (正面显示，背面只露外耳毛色)
		const innerEarLOpacity = clamp((earL_Nz + 0.1) / 0.35, 0, 1);
		const innerEarROpacity = clamp((earR_Nz + 0.1) / 0.35, 0, 1);
		this.earLInner.setAttribute("opacity", innerEarLOpacity.toFixed(3));
		this.earRInner.setAttribute("opacity", innerEarROpacity.toFixed(3));

		// 左右眼注视滑动 (正面化,不参与自旋)
		const R_FACE = 44;
		const phiEyeL = -0.74 + facePhi;
		const phiEyeR = 0.74 + facePhi;
		const nzL = Math.cos(phiEyeL);
		const nzR = Math.cos(phiEyeR);

		const eyeLX = 130 + R_FACE * Math.sin(phiEyeL) + pose.left.x + pose.left.lookX * 0.2;
		const eyeRX = 130 + R_FACE * Math.sin(phiEyeR) + pose.right.x + pose.right.lookX * 0.2;
		const eyeLY = 142 + pitchY + pose.left.y;
		const eyeRY = 142 + pitchY + pose.right.y;

		const cnL = clamp(nzL, 0, 1);
		const cnR = clamp(nzR, 0, 1);
		const opL = clamp(nzL / 0.16, 0, 1) * faceOp;
		const opR = clamp(nzR / 0.16, 0, 1) * faceOp;

		this.renderEye(
			this.eyeLG,
			this.eyeLNode,
			this.eyeLSparkleA,
			this.eyeLSparkleB,
			pose.left,
			eyeLX,
			eyeLY,
			cnL,
			opL,
		);
		this.renderEye(
			this.eyeRG,
			this.eyeRNode,
			this.eyeRSparkleA,
			this.eyeRSparkleB,
			pose.right,
			eyeRX,
			eyeRY,
			cnR,
			opR,
		);

		// 猫咪小嘴注视滑动 (正面化)
		const phiMouth = facePhi;
		const nzMouth = Math.cos(phiMouth);
		const mouthX = 130 + R_FACE * Math.sin(phiMouth);
		const mouthY = 142 + pitchY + 14 + b.mouthY;
		const mouthOp = clamp(nzMouth / 0.16, 0, 1) * faceOp;
		const persScaleX = (b.mouthScale ?? 1) * clamp(nzMouth, 0.02, 1);

		this.renderMouth(b, mouthX, mouthY, persScaleX, mouthOp);

		// 腮红注视滑动 (正面化)
		const phiBlushL = -1.18 + facePhi;
		const phiBlushR = 1.18 + facePhi;
		const nzBlushL = Math.cos(phiBlushL);
		const nzBlushR = Math.cos(phiBlushR);

		const blushLX = 130 + 56 * Math.sin(phiBlushL);
		const blushRX = 130 + 56 * Math.sin(phiBlushR);
		const blushY = 162 + pitchY * 0.85;

		const blushLOp = clamp(nzBlushL / 0.18, 0, 1) * b.blush * faceOp;
		const blushROp = clamp(nzBlushR / 0.18, 0, 1) * b.blush * faceOp;

		this.blushL.setAttribute("cx", blushLX.toFixed(2));
		this.blushL.setAttribute("cy", blushY.toFixed(2));
		this.blushL.setAttribute("rx", (15 * clamp(nzBlushL, 0.1, 1)).toFixed(2));
		this.blushL.setAttribute("opacity", blushLOp.toFixed(3));

		this.blushR.setAttribute("cx", blushRX.toFixed(2));
		this.blushR.setAttribute("cy", blushY.toFixed(2));
		this.blushR.setAttribute("rx", (15 * clamp(nzBlushR, 0.1, 1)).toFixed(2));
		this.blushR.setAttribute("opacity", blushROp.toFixed(3));

		// 轻柔猫咪胡须注视滑动 (正面化)
		const phiWhiskerL = -1.35 + facePhi;
		const phiWhiskerR = 1.35 + facePhi;
		const nzWhiskerL = Math.cos(phiWhiskerL);
		const nzWhiskerR = Math.cos(phiWhiskerR);

		const whiskerWobble = Math.sin((TAU * now) / 2800) * 1.2;
		const whiskerBaseOp = b.whiskers * 0.55;
		const whiskerLOp = whiskerBaseOp * clamp(nzWhiskerL / 0.18, 0, 1) * faceOp;
		const whiskerROp = whiskerBaseOp * clamp(nzWhiskerR / 0.18, 0, 1) * faceOp;

		this.whiskerLG.setAttribute("opacity", whiskerLOp.toFixed(3));
		this.whiskerRG.setAttribute("opacity", whiskerROp.toFixed(3));

		const whiskerLDx = 64 * Math.sin(phiWhiskerL) - 64 * Math.sin(-1.35);
		const whiskerRDx = 64 * Math.sin(phiWhiskerR) - 64 * Math.sin(1.35);

		this.whiskerLG.setAttribute(
			"transform",
			`translate(${whiskerLDx.toFixed(2)} ${pitchY.toFixed(2)}) ` +
				`rotate(${whiskerWobble.toFixed(2)} ${FACE.whiskerL[0]} ${FACE.whiskerL[1]})`,
		);
		this.whiskerRG.setAttribute(
			"transform",
			`translate(${whiskerRDx.toFixed(2)} ${pitchY.toFixed(2)}) ` +
				`rotate(${(-whiskerWobble).toFixed(2)} ${FACE.whiskerR[0]} ${FACE.whiskerR[1]})`,
		);

		// 独立左右前爪注视滑动 (正面化,随整脸淡出)
		const phiPawL = -0.56 + facePhi;
		const phiPawR = 0.56 + facePhi;
		const nzPawL = Math.cos(phiPawL);
		const nzPawR = Math.cos(phiPawR);

		const pawLOp = clamp(nzPawL / 0.18, 0, 1) * faceOp;
		const pawROp = clamp(nzPawR / 0.18, 0, 1) * faceOp;

		const pawLDx = 44 * Math.sin(phiPawL) - 44 * Math.sin(-0.56) + b.pawLX;
		const pawRDx = 44 * Math.sin(phiPawR) - 44 * Math.sin(0.56) + b.pawRX;
		const pawScaleXL = b.pawLScale * clamp(nzPawL, 0.1, 1);
		const pawScaleXR = b.pawRScale * clamp(nzPawR, 0.1, 1);

		this.pawLG.setAttribute("opacity", pawLOp.toFixed(3));
		this.pawRG.setAttribute("opacity", pawROp.toFixed(3));

		this.pawLG.setAttribute(
			"transform",
			`translate(${(FACE.pawL[0] + pawLDx).toFixed(2)} ${(FACE.pawL[1] + b.pawY + b.pawLY).toFixed(2)}) ` +
				`rotate(${b.pawLRot.toFixed(2)}) scale(${pawScaleXL.toFixed(3)} ${b.pawLScale.toFixed(3)}) ` +
				`translate(${-FACE.pawL[0]} ${-FACE.pawL[1]})`,
		);
		this.pawRG.setAttribute(
			"transform",
			`translate(${(FACE.pawR[0] + pawRDx).toFixed(2)} ${(FACE.pawR[1] + b.pawY + b.pawRY).toFixed(2)}) ` +
				`rotate(${b.pawRRot.toFixed(2)}) scale(${pawScaleXR.toFixed(3)} ${b.pawRScale.toFixed(3)}) ` +
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
			// 归一化轮廓点乘以眼半径
			node.setAttribute(
				"d",
				smoothClosedPath(
					ring.map(
						(p) => [p[0] * FACE.eyeRadius, p[1] * FACE.eyeRadius] as [number, number],
					),
				),
			);
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

		// 高光视差漂移
		const spx = eye.lookX * 0.12;
		const spy = eye.lookY * 0.12;
		sparkleA.setAttribute("cx", (-4.5 + spx).toFixed(2));
		sparkleA.setAttribute("cy", (-4.5 + spy).toFixed(2));
		sparkleB.setAttribute("cx", (4.0 + spx * 0.6).toFixed(2));
		sparkleB.setAttribute("cy", (3.5 + spy * 0.6).toFixed(2));
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
