import type { Drawing } from "../core/types.ts";

/** 整图的编排方式。 */
export type ScheduleMode = "sequential" | "parallel" | "stagger";

export interface ScheduleOptions {
	/** sequential：图元依次落笔；parallel：全部同时开始并同时结束；stagger：按顺序错开起笔、彼此重叠。 @default "sequential" */
	mode?: ScheduleMode;
	/** 落笔速度，场景弧长单位每秒。 @default 600 */
	speed?: number;
	/** 单个图元的最短与最长时长，秒。 @default [0.12, 2.5] */
	itemRange?: readonly [number, number];
	/** stagger 模式下相邻图元起笔的间隔，秒；缺省按总图元数折算，整体不超过 6 秒。 */
	gap?: number;
}

/** 每个图元在整图时间轴上的窗口，单位秒。 */
export interface Schedule {
	readonly mode: ScheduleMode;
	readonly duration: number;
	readonly start: Float32Array;
	readonly end: Float32Array;
}

/**
 * 为整图的图元分配时间窗口；窗口只依赖图元的自然时长，不改变笔画。
 *
 * @example
 * ```ts
 * const schedule = createSchedule(drawing, { mode: "stagger", speed: 800 });
 * seekSvg(svg, schedule.duration / 2);
 * ```
 */
export function createSchedule(drawing: Drawing, options: ScheduleOptions = {}): Schedule {
	const mode = options.mode ?? "sequential";
	const speed = options.speed ?? 600;
	const [min, max] = options.itemRange ?? [0.12, 2.5];
	const count = drawing.items.length;
	const start = new Float32Array(count);
	const end = new Float32Array(count);
	const natural = drawing.items.map((item) =>
		Math.max(min, Math.min(max, item.duration / speed)),
	);
	let duration = 0;
	if (mode === "parallel") {
		duration = Math.max(0, ...natural);
		for (let i = 0; i < count; i++) end[i] = duration;
	} else if (mode === "stagger") {
		const gap = options.gap ?? Math.min(0.12, 6 / Math.max(1, count));
		for (let i = 0; i < count; i++) {
			start[i] = i * gap;
			end[i] = start[i] + natural[i];
			duration = Math.max(duration, end[i]);
		}
	} else {
		let t = 0;
		for (let i = 0; i < count; i++) {
			start[i] = t;
			t += natural[i];
			end[i] = t;
		}
		duration = t;
	}
	return { mode, duration, start, end };
}

/** 图元在时间 t 的归一化进度，[0, 1]。 */
export function itemProgress(schedule: Schedule, index: number, t: number): number {
	const a = schedule.start[index];
	const b = schedule.end[index];
	if (t <= a) return 0;
	if (t >= b || b <= a) return 1;
	return (t - a) / (b - a);
}
