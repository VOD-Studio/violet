import type { EyeShapeId } from "../eyes";
import type { Anim } from "./animation";
import type { BodyPose, EyesSpec, SequenceFrame } from "./pose";

/**
 * 表情定义契约:一套表情的静态姿态 + 时间轴 + 循环动画 + 一次性动作。
 */

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
