/**
 * 数学与弹簧物理工具:引擎内全部纯数值算法。
 *
 * springStep 为半隐式欧拉积分的临界阻尼弹簧,驱动眼环变形/睁闭/过渡的平滑插值。
 */

/** 圆周率常数 */
export const TAU = Math.PI * 2;

/**
 * 钳制到闭区间。
 *
 * @param v - 待钳制值
 * @param a - 下界
 * @param b - 上界
 * @returns a ≤ 结果 ≤ b
 */
export function clamp(v: number, a: number, b: number): number {
	return v < a ? a : v > b ? b : v;
}

/**
 * 线性插值。
 *
 * @param a - 起点
 * @param b - 终点
 * @param t - 插值因子 [0, 1],不钳制
 * @returns a + (b − a)·t
 */
export function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

/**
 * 均匀随机取值。
 *
 * @param a - 下界(含)
 * @param b - 上界(含)
 */
export function rand(a: number, b: number): number {
	return a + Math.random() * (b - a);
}

/**
 * ease-in-out 三次缓动,自旋等一次性动作的时间曲线。
 *
 * @param t - 归一化进度 [0, 1]
 */
export function easeInOutCubic(t: number): number {
	return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** 临界阻尼弹簧状态:x 当前值、v 速度、t 目标值 */
export interface Spring {
	x: number;
	v: number;
	t: number;
}

/**
 * 构造静止在 v0 的弹簧。
 *
 * @param v0 - 初始位置与目标
 */
export function spring(v0: number): Spring {
	return { x: v0, v: 0, t: v0 };
}

/**
 * 弹簧步进(半隐式欧拉):就地向目标收敛,临界阻尼无过冲振荡。
 *
 * @param s - 弹簧状态(就地修改)
 * @param w - 固有角频率,越大收敛越快
 * @param z - 阻尼比,1 为临界阻尼
 * @param dt - 步长(秒)
 */
export function springStep(s: Spring, w: number, z: number, dt: number): void {
	const d = s.x - s.t;
	const ww = w * w;
	const f = -ww * d - 2 * z * w * s.v;
	s.v += f * dt;
	s.x += s.v * dt;
}
