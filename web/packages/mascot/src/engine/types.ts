/**
 * 表情体系类型契约 —— 姿态层(Anim 族 / Pose 族)与表情定义(EmotionDef)。
 *
 * 38 套表情数据(#00-#37,猫猫日常 / 喜怒哀乐 / 工作模式三组)见 emotions.ts。
 */

import type { MouthShapeId } from "./body";
import type { EyeShapeId } from "./eyes";
/**
 * 动画波形原语:决定 prop 随时间变化的曲线形状。
 *
 * - `sine`:正弦往复
 * - `pulse`:0→amp→0 余弦脉冲包络
 * - `jitter`:多频正弦叠加的伪随机抖动
 * - `scan`:三角波往返扫动
 * - `glance`:tanh 钳位的偶发瞥视
 * - `blink`:周期性瞬时闭眼
 */
export type AnimType = "sine" | "pulse" | "jitter" | "scan" | "glance" | "blink";

/** 动画作用目标:双眼 / 全身 / 左眼 / 右眼 */
export type AnimTarget = "eyes" | "body" | "left" | "right";

/** 动画作用的姿态属性(叠加在该 prop 当前值上) */
export type AnimProp =
	| "lookX"
	| "lookY"
	| "x"
	| "y"
	| "scale"
	| "rotate"
	| "open"
	| "pawLY"
	| "pawRY"
	| "pawLRot"
	| "pawRRot"
	| "tail";

export interface Anim {
	/** 波形类型 */
	type: AnimType;
	/** 作用目标 */
	target: AnimTarget;
	/** 作用的姿态属性 */
	prop: AnimProp;
	/** 输出幅值,叠加到 prop 当前值;缺省 1 */
	amp?: number;
	/** 波形周期(毫秒);blink 语义为闭眼间隔 */
	period?: number;
	/** 相位偏移(弧度) */
	phase?: number;
	/** 相位偏移(毫秒);scan/glance/blink 用它错开多路动画 */
	phaseMs?: number;
	/** jitter 频率因子(每秒);缺省 8 */
	speed?: number;
	/** 衰减时限(毫秒):t 超过它输出线性归零 */
	decay?: number;
	/** blink 单次闭眼时长(毫秒);缺省 200 */
	dur?: number;
}

/** 单眼姿态:全部可选,缺省继承 both 再被覆盖 */
export interface EyePose {
	/** 水平位移(viewBox 像素) */
	x?: number;
	/** 垂直位移(viewBox 像素) */
	y?: number;
	scaleX?: number;
	scaleY?: number;
	/** 旋转(弧度) */
	rotate?: number;
	/** 睁闭系数:0 闭眼、1 常态、可到 1.3 惊讶瞪大 */
	open?: number;
	/** 视线偏移:归一化 [-1, 1],乘注视幅度(viewBox 像素) */
	lookX?: number;
	lookY?: number;
}

/** 单爪姿态:位移为 viewBox 像素 */
export interface PawPose {
	x?: number;
	y?: number;
	/** 绕爪心支点旋转(弧度) */
	rotate?: number;
	scale?: number;
}

/** 身体姿态:位移为 viewBox 像素,角度为弧度 */
export interface BodyPose {
	x?: number;
	y?: number;
	scale?: number;
	rotate?: number;
	/** 身体填充色(仅个别表情做脸色变化,如生气涨红) */
	color?: string;
	/** 呼吸幅度系数 */
	breathe?: number;
	/** 腮红不透明度系数(0-1) */
	blush?: number;
	/** 左耳绕支点旋转(弧度);负值向内压即飞机耳 */
	earL?: number;
	/** 右耳绕支点旋转(弧度) */
	earR?: number;
	/** 尾巴摆动幅度系数(0-1) */
	tail?: number;
	/** 尾巴抬高系数(0-1) */
	tailElev?: number;
	/** 双爪整体垂直位移(viewBox 像素) */
	pawY?: number;
	pawL?: PawPose;
	pawR?: PawPose;
	/** 嘴型切换 */
	mouth?: MouthShapeId;
	/** 嘴巴垂直位移(viewBox 像素) */
	mouthY?: number;
	/** 嘴巴纵向缩放(1 常态,哈欠时放大) */
	mouthScale?: number;
	/** 胡须不透明度系数(0-1) */
	whiskers?: number;
	/** 思维光环粒子不透明度(>0 显示) */
	halo?: number;
	/** 睡眠 zzz 气泡强度(>0 显示) */
	zzz?: number;
}

/** 眼睛姿态分层:both 打底,left/right 覆盖,支持左右异形(如疑惑/Wink) */
export interface EyesSpec {
	both?: EyePose;
	left?: EyePose;
	right?: EyePose;
}

/** 时间轴关键帧:按 at 时刻插值到目标姿态 */
export interface SequenceFrame {
	/** 相对表情开始的时间(毫秒) */
	at: number;
	body?: BodyPose;
	eyes?: EyesSpec;
}

/** 一套表情的完整定义:静态姿态 + 时间轴 + 循环动画 + 一次性动作 */
export interface EmotionDef {
	id: string;
	name: string;
	en: string;
	/** 所属分组:猫猫日常 / 喜怒哀乐 / 工作模式 */
	group: "lifecycle" | "emotion" | "agent";
	/** 默认台词(对白气泡与 SDK 示例用) */
	desc: string;
	/** 切入本表情的姿态过渡时长(毫秒);缺省 500 */
	transition?: number;
	/** false = 冻结视线(睡眠/发呆类不跟指针) */
	gaze?: boolean;
	/** 待机眼环池:按 poolMs 节奏轮换,轮换经眼环弹簧平滑变形 */
	pool: EyeShapeId[];
	/** 左右异形眼环(替代 pool 轮换,如 Wink) */
	pair?: [EyeShapeId, EyeShapeId];
	/** 眼环轮换间隔范围(毫秒);缺省 [9000, 16000] */
	poolMs?: [number, number];
	/** 眼环变形速度;缺省 6,≥10 用快速档 */
	poolSpeed?: number;
	/** 眨眼间隔范围(毫秒);null = 不眨眼 */
	blinkMs?: [number, number] | null;
	/** 基础睁眼系数;缺省 1 */
	openness?: number;
	/** 待机小动作(偶发耳朵抽动等,仅运行中生效) */
	antics?: boolean;
	/** 上场自旋圈数 */
	spin?: number;
	/** 上场撒花强度(粒子数 = 20 × 该值;仅运行中生效) */
	confetti?: number;
	/** 静态身体姿态(base 层) */
	body?: BodyPose;
	/** 静态眼睛姿态(base 层) */
	eyes?: EyesSpec;
	/** 循环动画(anims 层,叠加在 base 之上) */
	anims?: Anim[];
	/** 一次性时间轴:播完后按 settle 落定 */
	sequence?: {
		/** 播完去向:回 base 基态 / 冻结末帧 / 切换到另一表情 */
		settle: "base" | "hold" | { next: string };
		frames: SequenceFrame[];
	};
}
