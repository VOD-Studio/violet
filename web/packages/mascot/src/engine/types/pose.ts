/**
 * 静态姿态契约:表情定义中的可选姿态层(body/eyes)与时间轴关键帧。
 */
import type { MouthShapeId } from "../characters/catMochi/geometry";

/** 单眼姿态:全部可选,both 打底、left/right 覆盖,支持左右异形 */
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
