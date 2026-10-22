/** 导出的取帧计划。 */
export interface FramePlan {
	/** 每帧在导出时间轴上的时刻，秒；首帧为 0，末帧为导出时长。 */
	readonly times: readonly number[];
	/** 每帧的显示时长，1/100 秒；末帧含停留。 */
	readonly delays: readonly number[];
}

// 浏览器把 0–1 的 GIF 延迟按 10 播放，短于 2/100 秒的帧并入前一帧。
const MIN_DELAY = 2;

/**
 * 按帧率在 [0, duration] 上取帧，末帧停留 hold 秒（至少一帧间隔）。
 *
 * @remarks 延迟按累计时刻取整，总时长不随帧数漂移。
 */
export function planFrames(duration: number, fps: number, hold: number): FramePlan {
	const times: number[] = [];
	for (let i = 0; i / fps < duration - 1e-9; i++) times.push(i / fps);
	times.push(duration);
	const last = Math.max(MIN_DELAY, Math.round(hold * 100), Math.round(100 / fps));
	const outTimes: number[] = [];
	const outDelays: number[] = [];
	times.forEach((time, i) => {
		const delay =
			i < times.length - 1 ? Math.round(times[i + 1] * 100) - Math.round(time * 100) : last;
		if (delay < MIN_DELAY && outDelays.length) outDelays[outDelays.length - 1] += delay;
		else {
			outTimes.push(time);
			outDelays.push(delay);
		}
	});
	return { times: outTimes, delays: outDelays };
}
