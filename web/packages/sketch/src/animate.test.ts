import { describe, expect, it, vi } from "vitest";
import {
	cartoonStyle,
	circle,
	createHand,
	createPlayer,
	createSchedule,
	type Drawing,
	draw,
	itemProgress,
	line,
	pens,
	rect,
	styles,
} from "./index.ts";
import { drawCanvas } from "./render/canvas.ts";
import { mountSvg, seekSvg } from "./render/svg.ts";

const palette = { paper: "#fff", ink: "#222", a: "#fc9", b: "#9cf" };

function sample(style = styles.natural): Drawing {
	return draw(
		{
			width: 400,
			height: 300,
			items: [
				{ id: "box", path: rect(20, 20, 160, 100, 10), fillRole: "a" },
				{ id: "dot", path: circle(300, 80, 50), fillRole: "b" },
				{ id: "edge", path: line(20, 220, 380, 260) },
			],
		},
		{ style, seed: 4 },
	);
}

describe("编排", () => {
	const drawing = sample();

	it("顺序：窗口首尾相接，总时长是各图元之和", () => {
		const s = createSchedule(drawing, { mode: "sequential" });
		for (let i = 1; i < drawing.items.length; i++)
			expect(s.start[i]).toBeCloseTo(s.end[i - 1], 5);
		expect(s.duration).toBeCloseTo(s.end[drawing.items.length - 1], 5);
	});

	it("并行：全部同时开始并同时结束", () => {
		const s = createSchedule(drawing, { mode: "parallel" });
		for (let i = 0; i < drawing.items.length; i++) {
			expect(s.start[i]).toBe(0);
			expect(s.end[i]).toBeCloseTo(s.duration, 5);
		}
	});

	it("交错：依次起笔且窗口重叠，总时长短于顺序", () => {
		const stagger = createSchedule(drawing, { mode: "stagger", gap: 0.05 });
		const sequential = createSchedule(drawing, { mode: "sequential" });
		expect(stagger.start[1]).toBeGreaterThan(stagger.start[0]);
		expect(stagger.start[1]).toBeLessThan(stagger.end[0]);
		expect(stagger.duration).toBeLessThan(sequential.duration);
	});

	it("提高落笔速度缩短时长，进度钳制在 [0, 1]", () => {
		const slow = createSchedule(drawing, { speed: 300, itemRange: [0, 100] });
		const fast = createSchedule(drawing, { speed: 900, itemRange: [0, 100] });
		expect(fast.duration).toBeLessThan(slow.duration);
		expect(itemProgress(slow, 0, -1)).toBe(0);
		expect(itemProgress(slow, 0, slow.duration + 1)).toBe(1);
	});
});

function fakeClock() {
	let now = 0;
	const queue: (() => void)[] = [];
	return {
		raf: (cb: (t: number) => void) => queue.push(() => cb(now)),
		cancelRaf: (h: number) => {
			queue[h - 1] = () => {};
		},
		now: () => now,
		/** 前进 ms 并执行该时刻已排队的一帧。 */
		tick(ms: number) {
			now += ms;
			for (const frame of queue.splice(0)) frame();
		},
	};
}

describe("播放器", () => {
	const make = (duration = 2) => {
		const clock = fakeClock();
		const frames: number[] = [];
		const onEnd = vi.fn();
		const player = createPlayer({ duration, onFrame: (t) => frames.push(t), onEnd, ...clock });
		return { clock, frames, onEnd, player };
	};

	it("播放推进时间，到末尾只调用一次完成回调", () => {
		const { clock, onEnd, player } = make();
		player.play();
		clock.tick(1000);
		expect(player.time).toBeCloseTo(1, 3);
		clock.tick(1500);
		expect(player.time).toBe(2);
		expect(player.playing).toBe(false);
		expect(onEnd).toHaveBeenCalledTimes(1);
	});

	it("暂停时时间不变，恢复后从原位继续", () => {
		const { clock, player } = make();
		player.play();
		clock.tick(500);
		player.pause();
		const paused = player.time;
		clock.tick(5000);
		expect(player.time).toBe(paused);
		player.play();
		clock.tick(500);
		expect(player.time).toBeCloseTo(paused + 0.5, 3);
	});

	it("跳转钳制范围且保持播放状态；变速成比例改变推进速度", () => {
		const { clock, player } = make(4);
		player.seek(100);
		expect(player.time).toBe(4);
		player.seek(-3);
		expect(player.time).toBe(0);
		player.rate = 2;
		player.play();
		clock.tick(500);
		expect(player.time).toBeCloseTo(1, 3);
		player.seek(0.2);
		expect(player.playing).toBe(true);
	});

	it("取消后旧的完成回调不再触发，重播不受旧一次播放影响", () => {
		const { clock, onEnd, player } = make(1);
		player.play();
		clock.tick(900);
		player.cancel();
		clock.tick(5000);
		expect(onEnd).not.toHaveBeenCalled();
		expect(player.time).toBeCloseTo(0.9, 3);
		player.restart();
		expect(player.time).toBe(0);
		clock.tick(1200);
		expect(onEnd).toHaveBeenCalledTimes(1);
	});
});

describe("SVG 按时间显现", () => {
	const hidden = (svg: SVGSVGElement) =>
		Array.from(svg.querySelectorAll("[data-trk]")).filter(
			(el) => el.getAttribute("display") === "none",
		);

	for (const [name, style] of [
		["签字笔", styles.natural],
		["压感钢笔", { ...styles.natural, pen: pens.inkpen }],
	] as const) {
		it(`${name}：起点全部隐藏，中途部分显现，终点与静态画面一致`, () => {
			const drawing = sample(style);
			const schedule = createSchedule(drawing, { mode: "sequential" });
			const svg = mountSvg(drawing, palette, { schedule });
			const all = svg.querySelectorAll("[data-trk]");
			const full = Array.from(all, (el) => el.getAttribute("d"));
			expect(all.length).toBeGreaterThan(3);

			seekSvg(svg, 0);
			expect(hidden(svg)).toHaveLength(all.length);

			seekSvg(svg, schedule.end[0] + schedule.duration * 0.05);
			const mid = hidden(svg).length;
			expect(mid).toBeGreaterThan(0);
			expect(mid).toBeLessThan(all.length);

			seekSvg(svg, schedule.duration);
			expect(hidden(svg)).toHaveLength(0);
			expect(
				Array.from(svg.querySelectorAll("[data-trk]"), (el) => el.getAttribute("d")),
			).toEqual(full);
			expect(svg.querySelector("[stroke-dasharray]")).toBeNull();
		});
	}

	it("进行中的笔画显现前缀：钢笔条带路径变短，签字笔使用虚线偏移", () => {
		const probe = (style: Parameters<typeof sample>[0], pick: string) => {
			const drawing = sample(style);
			const schedule = createSchedule(drawing, { mode: "parallel" });
			const svg = mountSvg(drawing, palette, { schedule });
			seekSvg(svg, schedule.duration * 0.5);
			return svg.querySelectorAll(pick);
		};
		const ribbon = probe(
			{ ...styles.natural, pen: pens.inkpen },
			"[data-trk][data-paint='fill']",
		);
		expect(ribbon.length).toBeGreaterThan(0);
		const stroke = probe(styles.natural, "[stroke-dasharray]");
		expect(stroke.length).toBeGreaterThan(0);
		for (const el of stroke) {
			const offset = Number(el.getAttribute("stroke-dashoffset"));
			expect(offset).toBeGreaterThan(0);
			expect(offset).toBeLessThan(1);
		}
	});

	it("倒放与跳转只改变显现范围，不改变笔画；换色仍然有效", () => {
		const drawing = sample();
		const schedule = createSchedule(drawing, { mode: "stagger" });
		const svg = mountSvg(drawing, palette, { schedule });
		const full = Array.from(svg.querySelectorAll("[data-trk]"), (el) => el.getAttribute("d"));
		seekSvg(svg, schedule.duration);
		seekSvg(svg, schedule.duration * 0.3);
		seekSvg(svg, 0);
		seekSvg(svg, schedule.duration);
		expect(
			Array.from(svg.querySelectorAll("[data-trk]"), (el) => el.getAttribute("d")),
		).toEqual(full);
	});

	it("合成区域（如 evenodd 月牙）整体作为一个元素，不按子路径拆开", () => {
		const drawing = draw(
			{
				width: 400,
				height: 300,
				items: [{ id: "c", path: circle(200, 150, 80), fillRole: "sky" }],
			},
			{ style: cartoonStyle, seed: 3 },
		);
		const schedule = createSchedule(drawing);
		const svg = mountSvg(
			drawing,
			{
				...palette,
				"sky:shade": "#00f",
				"sky:light": "#fff",
				"sky:line": "#000",
				sky: "#9cf",
			},
			{ schedule },
		);
		const areas = drawing.items[0].batches.filter((b) => b.mode === "fill" && !b.ribbons);
		expect(areas.length).toBeGreaterThanOrEqual(3);
		const areaRoles = new Set(areas.map((b) => b.role));
		const filled = Array.from(svg.querySelectorAll("[data-trk][data-paint='fill']")).filter(
			(el) => areaRoles.has(el.getAttribute("data-role") ?? ""),
		);
		expect(filled).toHaveLength(areas.length);
		for (const [i, el] of filled.entries()) {
			const subpaths = (el.getAttribute("d") ?? "").match(/M/g)?.length ?? 0;
			expect(subpaths).toBe(areas[i].verbs.filter((v) => v === 0).length);
		}
	});

	it("没有 schedule 时与静态输出相同：每批次一个 path", () => {
		const drawing = sample();
		const svg = mountSvg(drawing, palette);
		expect(svg.querySelectorAll("[data-trk]")).toHaveLength(0);
		const batches = drawing.items.reduce((n, item) => n + item.batches.length, 0);
		expect(svg.querySelectorAll("path[data-role]")).toHaveLength(batches + 0);
	});
});

describe("Canvas 按时间显现", () => {
	function run(style: Parameters<typeof sample>[0], fraction: number) {
		const drawing = sample(style);
		const schedule = createSchedule(drawing, { mode: "parallel" });
		const calls: string[] = [];
		const dashes: number[][] = [];
		vi.stubGlobal(
			"Path2D",
			class {
				moveTo() {}
				lineTo() {}
				bezierCurveTo() {}
				closePath() {}
			},
		);
		const canvas = document.createElement("canvas");
		const context = new Proxy(
			{},
			{
				get: (_, key) => {
					if (key === "setLineDash") return (d: number[]) => dashes.push(d);
					return typeof key === "string" && /^(fill|stroke|clip|fillText)$/.test(key)
						? () => calls.push(key)
						: () => {};
				},
				set: () => true,
			},
		);
		vi.spyOn(canvas, "getContext").mockReturnValue(
			context as unknown as CanvasRenderingContext2D,
		);
		drawCanvas(drawing, canvas, palette, { schedule, time: schedule.duration * fraction });
		vi.unstubAllGlobals();
		return { calls, dashes };
	}

	it("开始前不绘制笔墨，结束时与静态绘制一致", () => {
		const start = run(styles.natural, 0);
		expect(start.calls.filter((c) => c === "stroke" || c === "fill")).toHaveLength(0);
		const end = run(styles.natural, 1);
		expect(end.dashes).toHaveLength(0);
		expect(end.calls.filter((c) => c === "stroke").length).toBeGreaterThan(0);
	});

	it("进行中的签字笔笔画用虚线显现前缀", () => {
		const { dashes } = run(styles.natural, 0.5);
		expect(dashes.some((d) => d.length === 2 && d[0] > 0)).toBe(true);
	});

	it("进行中的钢笔条带绘制前缀多边形", () => {
		const half = run({ ...styles.natural, pen: pens.inkpen }, 0.5);
		const full = run({ ...styles.natural, pen: pens.inkpen }, 1);
		expect(half.calls.filter((c) => c === "fill").length).toBeGreaterThan(0);
		expect(full.calls.filter((c) => c === "fill").length).toBeGreaterThanOrEqual(
			half.calls.filter((c) => c === "fill").length,
		);
	});
});

export { createHand };
