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
