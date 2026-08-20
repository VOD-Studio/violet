/**
 * Mascot 引擎门面 —— 共享 ticker、宿主交互、生命周期与显式编排。
 *
 * 职责拆分:姿态时间状态机见 poseController.ts,堇喵 SVG 结构与渲染见
 * characters/catMochi/,彩带/彩屑特效见 effects/,表情目录见 emotions.ts。
 */

import { CatMochiRenderer } from "./characters/catMochi";
import { ConfettiFX } from "./effects/confetti";
import { RibbonFX } from "./effects/ribbons";
import { DEFAULT_EMOTION_ID, EMOTION_MAP, EMOTIONS } from "./emotions";
import { PoseController } from "./poseController";
import type { FrameContext } from "./types";

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

export class Mascot {
	private static readonly FALLBACK = EMOTIONS[0];

	private destroyed = false;
	private readonly renderer: CatMochiRenderer;
	private readonly controller: PoseController;
	private readonly ribbons: RibbonFX;
	private readonly confetti: ConfettiFX;
	/** 复用的帧上下文:compose 填充时间与身体跟随参数,render 消费 */
	private readonly frame: FrameContext = {
		now: 0,
		dt: 0,
		leanShift: 0,
		leanRot: 0,
		leanSquash: 1,
		haloFast: false,
	};

	/* 摸摸头指针检测状态 */
	private petMoveDist = 0;
	private lastPetCheck = 0;
	private lastPointerPos = { x: 0, y: 0 };

	private running = false;
	private clickHandler?: () => void;
	private onPetHandler?: () => void;
	private pointerMoveHandler?: (e: MouseEvent) => void;

	constructor(
		private el: HTMLElement,
		opts: MascotOptions,
	) {
		const def = EMOTION_MAP.get(opts.emotion ?? DEFAULT_EMOTION_ID) ?? Mascot.FALLBACK;
		this.onPetHandler = opts.onPet;
		this.renderer = new CatMochiRenderer();
		this.controller = new PoseController(def);
		this.ribbons = new RibbonFX(this.renderer.mounts);
		this.confetti = new ConfettiFX(this.renderer.mounts);
		this.el.appendChild(this.renderer.root);
		if (opts.onClick) {
			this.clickHandler = opts.onClick;
			this.renderer.root.addEventListener("click", this.clickHandler);
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
		this.controller.setEmotion(def);
		if (def.confetti && this.running) this.confetti.burst(Math.round(20 * def.confetti));
	}

	/**
	 * 手动设置偏航角(度):调试通道,直接叠加在自旋结果上。
	 * 非运行实例重渲静态帧。
	 */
	setDevYaw(deg: number): void {
		this.controller.setDevYaw(deg);
		if (!this.controller.hasSpin()) this.ribbons.clear();
		if (!this.running) this.renderStatic();
	}

	/**
	 * 设置注视目标。
	 *
	 * @param nx - 水平归一化 [-1, 1],越界钳制
	 * @param ny - 垂直归一化 [-1, 1],越界钳制
	 */
	setGaze(nx: number, ny: number): void {
		this.controller.setGaze(nx, ny);
	}

	/**
	 * 触发摸头互动:飞机耳 + 头顶爱心,持续期内可重复触发。
	 *
	 * @param durationMs - 互动持续时间(毫秒),缺省 1200
	 */
	pet(durationMs = 1200): void {
		this.controller.pet(durationMs);
		this.onPetHandler?.();
	}

	/**
	 * 自旋指定圈数:落点取 n 圈外最近整圈位,结束时 yaw 归零无跳变。
	 *
	 * @param turns - 圈数(向上取整),缺省 1
	 */
	spinTurns(turns = 1): void {
		this.controller.spinTurns(turns);
	}

	/**
	 * 撒花庆祝:从身体中心向外爆开彩纸/星星。
	 *
	 * @param count - 目标粒子数,缺省 20;场上上限 60
	 */
	burst(count = 20): void {
		this.confetti.burst(count);
		if (this.running && !rafId) {
			lastT = performance.now();
			rafId = requestAnimationFrame(loop);
		}
	}

	bounce(): void {
		this.controller.bounce();
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
		if (this.clickHandler) this.renderer.root.removeEventListener("click", this.clickHandler);
		if (this.pointerMoveHandler)
			this.renderer.root.removeEventListener("pointermove", this.pointerMoveHandler);
		this.ribbons.clear();
		this.confetti.clear();
		this.renderer.destroy();
		this.destroyed = true;
	}

	/* ----- 内部驱动 ----- */

	tick(now: number, dt: number): void {
		if (this.destroyed) return;
		this.frame.now = now;
		this.frame.dt = dt;
		const pose = this.controller.compose(now, dt, this.running, this.frame);
		this.renderer.render(pose, this.frame);
		this.ribbons.step(now, dt, pose.yaw);
		this.confetti.step(dt);
	}

	private renderStatic(): void {
		this.controller.prepareStatic();
		this.tick(performance.now(), 1 / 60);
		this.controller.restoreStatic();
	}

	private initInteractions(): void {
		this.pointerMoveHandler = (e: MouseEvent) => {
			const rect = this.renderer.root.getBoundingClientRect();
			if (!rect.width || !rect.height) return;
			// 转换为 0~260 viewBox 坐标
			const vx = ((e.clientX - rect.left) / rect.width) * 260;
			const vy = ((e.clientY - rect.top) / rect.height) * 260;

			// 检查是否在头部区域摸摸 (x in [75, 185], y in [30, 125])
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
		this.renderer.root.addEventListener("pointermove", this.pointerMoveHandler);
	}
}
