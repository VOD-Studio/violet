/**
 * 渲染帧上下文:门面每帧复用同一实例,由姿态控制器填充时间与身体跟随
 * 参数,形象 renderer 消费,避免逐帧对象分配。
 */

/** 一帧的时间与跨部件环境参数。 */
export interface FrameContext {
	/** performance.now() 时间戳(毫秒) */
	now: number;
	/** 帧步长(秒) */
	dt: number;
	/** 身体重心跟随平移(viewBox px) */
	leanShift: number;
	/** 身体侧倾角(deg) */
	leanRot: number;
	/** 身体横向压缩系数,1 = 无压缩 */
	leanSquash: number;
	/** 思考环带快转档:poolMs < 600 的表情转得更快 */
	haloFast: boolean;
}
