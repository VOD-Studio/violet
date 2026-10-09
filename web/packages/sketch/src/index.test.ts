import { describe, expect, it, vi } from "vitest";
import {
	BatchBuilder,
	BudgetExceeded,
	CUBIC,
	circle,
	createHand,
	curve,
	type Drawing,
	draw,
	type Fill,
	fills,
	flatten,
	type Hand,
	type InkBatch,
	line,
	MOVE,
	type Pen,
	pathFromSvg,
	polygon,
	polylineContour,
	rect,
	type SceneItem,
	styles,
} from "./index.ts";
import { drawCanvas } from "./render/canvas.ts";
import { renderSvg } from "./render/svg.ts";

const palette = { paper: "#fff", ink: "#222", a: "#fc9", b: "#9cf" };

function scene(items: SceneItem[]) {
	return { width: 400, height: 300, items };
}

function batchesOf(drawing: Drawing, id: string): readonly InkBatch[] {
	const item = drawing.items.find((i) => i.id === id);
	if (!item) throw new Error(`missing ${id}`);
	return item.batches;
}

function coordsOf(batches: readonly InkBatch[]): number[][] {
	return batches.map((b) => Array.from(b.coords));
}

/** 按动词拆出每个子路径的起点与终点。 */
function subpathEnds(batch: InkBatch): { start: [number, number]; end: [number, number] }[] {
	const result: { start: [number, number]; end: [number, number] }[] = [];
	let c = 0;
	for (const verb of batch.verbs) {
		if (verb === MOVE) {
			const p: [number, number] = [batch.coords[c], batch.coords[c + 1]];
			result.push({ start: p, end: p });
			c += 2;
		} else if (verb === CUBIC) {
			result[result.length - 1].end = [batch.coords[c + 4], batch.coords[c + 5]];
			c += 6;
		} else if (verb !== 3) {
			result[result.length - 1].end = [batch.coords[c], batch.coords[c + 1]];
			c += 2;
		}
	}
	return result;
}

const base: SceneItem[] = [
	{ id: "box", path: rect(20, 20, 120, 70, 8), fillRole: "a" },
	{ id: "ring", path: circle(250, 80, 50), fillRole: "b" },
	{ id: "edge", path: line(20, 200, 380, 260), pinEnds: true },
];

describe("draw", () => {
	it("同一输入与 seed 逐位相同", () => {
		const a = draw(scene(base), { style: styles.natural, seed: 9 });
		const b = draw(scene(base), { style: styles.natural, seed: 9 });
		for (const item of base)
			expect(coordsOf(batchesOf(a, item.id))).toEqual(coordsOf(batchesOf(b, item.id)));
	});

	it("修改一个图元不影响其他图元，换填充不改变描边几何", () => {
		const style = { ...styles.natural, fill: fills.hachure };
		const before = draw(scene(base), { style, seed: 3 });
		const changed = draw(
			scene([
				{ ...base[0], style: { ...style, fill: fills["cross-hatch"] } },
				base[1],
				{ ...base[2], path: line(20, 200, 300, 280) },
			]),
			{ style, seed: 3 },
		);
		expect(coordsOf(batchesOf(changed, "ring"))).toEqual(coordsOf(batchesOf(before, "ring")));
		const outline = (d: Drawing) => batchesOf(d, "box").filter((b) => b.role === "ink");
		expect(coordsOf(outline(changed))).toEqual(coordsOf(outline(before)));
	});

	it("pinEnds 的开放路径首尾保持原坐标", () => {
		const drawing = draw(scene(base), { style: styles.draft, seed: 5 });
		for (const batch of batchesOf(drawing, "edge")) {
			const ends = subpathEnds(batch);
			expect(ends[0].start[0]).toBeCloseTo(20, 3);
			expect(ends[0].start[1]).toBeCloseTo(200, 3);
			expect(ends[ends.length - 1].end[0]).toBeCloseTo(380, 3);
			expect(ends[ends.length - 1].end[1]).toBeCloseTo(260, 3);
		}
	});

	it("evenodd 与 nonzero 孔洞内没有填充笔墨", () => {
		const hole = (rule: "evenodd" | "nonzero") =>
			pathFromSvg(
				rule === "evenodd"
					? "M100 50h200v200h-200zM150 100h100v100h-100z"
					: "M100 50h200v200h-200zM150 100v100h100v-100z",
				rule,
			);
		for (const rule of ["evenodd", "nonzero"] as const) {
			for (const fill of [fills.hachure, fills["cross-hatch"], fills.zigzag, fills.dots]) {
				const drawing = draw(
					scene([{ id: "h", path: hole(rule), fillRole: "a", strokeRole: "none" }]),
					{
						style: { ...styles.natural, fill },
					},
				);
				for (const batch of batchesOf(drawing, "h")) {
					expect(batch.clip?.fillRule).toBe(rule);
					const c = batch.coords;
					for (let i = 0; i < c.length; i += 2) {
						const inside = c[i] > 156 && c[i] < 244 && c[i + 1] > 106 && c[i + 1] < 194;
						expect(inside, `${rule} ${fill.id} (${c[i]}, ${c[i + 1]})`).toBe(false);
					}
				}
			}
		}
	});

	it("闭合无角点轮廓首尾重叠，有角点轮廓断笔处越界", () => {
		const steady = {
			...styles.natural,
			hand: createHand({ roughness: 0, bowing: 0, breakChance: 1 }),
		};
		const drawing = draw(
			scene([
				{ id: "c", path: circle(200, 150, 50) },
				{ id: "r", path: rect(50, 50, 100, 60) },
			]),
			{ style: steady },
		);
		const [ringBatch] = batchesOf(drawing, "c");
		const ring = subpathEnds(ringBatch);
		expect(ring).toHaveLength(1);
		// 各段端点间弦长之和低估弧长，大于周长即说明存在重叠。
		let length = 0;
		const c = ringBatch.coords;
		for (let i = 2; i < c.length; i += 6)
			length += Math.hypot(c[i + 4] - c[i - 2], c[i + 5] - c[i - 1]);
		expect(length).toBeGreaterThan(2 * Math.PI * 50 * 1.03);

		const sides = subpathEnds(batchesOf(drawing, "r")[0]);
		expect(sides).toHaveLength(4);
		// 越界为线宽量级的随机值：端点不得缩进矩形内，且四条边累计必须有可见越界。
		const beyond = ([x, y]: [number, number]) =>
			Math.max(49.99 - x, x - 150.01, 49.99 - y, y - 110.01);
		let total = 0;
		for (const side of sides) {
			for (const end of [side.start, side.end]) {
				expect(beyond(end)).toBeGreaterThan(-0.05);
				total += Math.max(0, beyond(end));
			}
		}
		expect(total).toBeGreaterThan(1);
	});

	it("超出预算时抛出 BudgetExceeded 且不返回结果", () => {
		expect(() => draw(scene(base), { style: styles.natural, maxVertices: 10 })).toThrow(
			BudgetExceeded,
		);
		expect(() => draw(scene(base), { style: styles.natural, maxStrokes: 1 })).toThrow(
			BudgetExceeded,
		);
	});
});

describe("角点检测", () => {
	const cornerCount = (path: ReturnType<typeof polygon>) =>
		flatten(path, 0.25).contours.reduce((n, c) => n + c.corners.length, 0);

	it("四角星的内凹顶点转角只有约 50°，也必须识别为角点，否则星形会退化成菱形", () => {
		const points: [number, number][] = [];
		for (let i = 0; i < 8; i++) {
			const a = (Math.PI * i) / 4 - Math.PI / 2;
			const d = i % 2 ? 9 : 24;
			points.push([40 + d * Math.cos(a), 40 + d * Math.sin(a)]);
		}
		expect(cornerCount(polygon(points))).toBe(8);
	});

	it("光滑曲线、圆与圆角矩形不产生角点，直角矩形有四个", () => {
		expect(cornerCount(circle(100, 100, 50))).toBe(0);
		expect(cornerCount(rect(10, 10, 100, 60, 12))).toBe(0);
		expect(cornerCount(rect(10, 10, 100, 60))).toBe(4);
		expect(
			cornerCount(
				curve([
					[0, 0],
					[50, 40],
					[100, 0],
					[150, 40],
				]),
			),
		).toBe(0);
	});
});

describe("外部扩展", () => {
	const straightHand: Hand = {
		id: "ruler",
		strokes(skeleton) {
			return skeleton.contours.map((contour) => {
				const n = contour.points.length / 2;
				const points = new Float32Array(n * 4);
				for (let i = 0; i < n; i++) {
					points.set(
						[contour.points[i * 2], contour.points[i * 2 + 1], 1, contour.arc[i]],
						i * 4,
					);
				}
				return { points, curve: false, closed: contour.closed, pass: 0 };
			});
		},
	};
	const ribbonPen: Pen = {
		id: "ribbon",
		ink(strokes, ctx, role) {
			const batch = new BatchBuilder({
				mode: "stroke",
				role,
				width: ctx.width * 3,
				opacity: 0.4,
			});
			for (const stroke of strokes) batch.stroke(stroke);
			return batch.empty ? [] : [batch.build()];
		},
	};
	const crossFill: Fill = {
		id: "cross",
		generate(region) {
			const c = region.contours[0].points;
			return {
				guides: {
					fillRule: "nonzero",
					contours: [
						polylineContour([c[0], c[1], c[4], c[5]]),
						polylineContour([c[2], c[3], c[6], c[7]]),
					],
				},
			};
		},
	};

	it("不修改核心即可生成并以 SVG 与 Canvas 渲染", () => {
		const drawing = draw(scene([{ id: "x", path: rect(50, 50, 200, 120), fillRole: "a" }]), {
			style: { hand: straightHand, pen: ribbonPen, fill: crossFill },
		});
		const batches = batchesOf(drawing, "x");
		expect(batches.map((b) => b.role)).toEqual(["a", "ink"]);
		expect(batches[0].clip).toBeDefined();

		const svg = renderSvg(drawing, palette);
		expect(svg.match(/<path /g)).toHaveLength(3);
		expect(svg).toContain('opacity="0.4"');

		const calls: string[] = [];
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
				get: (_, key) =>
					typeof key === "string" && /^(fill|stroke|clip)$/.test(key)
						? () => calls.push(key)
						: () => {},
				set: () => true,
			},
		);
		vi.spyOn(canvas, "getContext").mockReturnValue(
			context as unknown as CanvasRenderingContext2D,
		);
		drawCanvas(drawing, canvas, palette);
		expect(calls).toEqual(["clip", "stroke", "stroke"]);
		vi.unstubAllGlobals();
	});
});
