import { describe, expect, it } from "vitest";
import {
	animeStyle,
	circle,
	createAnimeStyle,
	createFineliner,
	createGPen,
	createHand,
	createInkPen,
	createMarker,
	createRibbonPen,
	createWashFill,
	type Drawing,
	draw,
	type InkBatch,
	line,
	type PenFactory,
	pens,
	rect,
	type SceneItem,
	styles,
} from "./index.ts";
import { renderSvg } from "./render/svg.ts";

const scene = (items: SceneItem[]) => ({ width: 400, height: 300, items });

/** 条带批次中第 index 个子路径在第 i 个样本处的左右点间距，即该处的笔宽。 */
function widthAt(batch: InkBatch, sub: number, fraction: number): number {
	const n = batch.ribbons?.[sub * 2] ?? 0;
	const c = batch.ribbons?.[sub * 2 + 1] ?? 0;
	// 只有单个条带子路径时，坐标从 0 起算。
	const i = Math.min(n - 1, Math.floor(fraction * (n - 1)));
	const l = [batch.coords[i * 2], batch.coords[i * 2 + 1]];
	const j = n + c + (n - 1 - i);
	const r = [batch.coords[j * 2], batch.coords[j * 2 + 1]];
	return Math.hypot(l[0] - r[0], l[1] - r[1]);
}

const ruler = createHand({ roughness: 0, bowing: 0, breakChance: 0, overshoot: 0, taper: 12 });

describe("压感与笔", () => {
	const inkpen = { hand: ruler, pen: pens.inkpen };

	it("钢笔的线宽随压力变化：两端收尖、中段最宽", () => {
		const drawing = draw(scene([{ id: "l", path: line(20, 100, 380, 100) }]), {
			style: inkpen,
			width: 3,
		});
		const [batch] = drawing.items[0].batches;
		expect(batch.mode).toBe("fill");
		expect(batch.ribbons?.[0]).toBeGreaterThan(10);
		const ends = widthAt(batch, 0, 0.01);
		const middle = widthAt(batch, 0, 0.5);
		expect(middle).toBeGreaterThan(ends * 2.5);
		expect(widthAt(batch, 0, 0.99)).toBeLessThan(middle / 2);
	});

	it("签字笔默认恒宽并走原生描边，打开 pressure 后变宽", () => {
		const items = [{ id: "l", path: line(20, 100, 380, 100) }];
		const plain = draw(scene(items), { style: { hand: ruler, pen: pens.fineliner } });
		expect(plain.items[0].batches[0].mode).toBe("stroke");
		expect(plain.items[0].batches[0].ribbons).toBeUndefined();
		const pressed = draw(scene(items), {
			style: { hand: ruler, pen: createFineliner({ pressure: 0.5 }) },
		});
		expect(pressed.items[0].batches[0].ribbons).toBeDefined();
	});

	it("扁笔尖的宽度取决于行笔方向", () => {
		const marker = { hand: ruler, pen: createMarker({ angle: 0, aspect: 0.2, weight: 6 }) };
		const flat = (path: ReturnType<typeof line>) =>
			draw(scene([{ id: "m", path }]), { style: marker, width: 2 }).items[0].batches[0];
		// 笔尖长轴水平：水平行笔时厚度取短轴，竖直行笔时取长轴。
		const horizontal = widthAt(flat(line(50, 100, 350, 100)), 0, 0.5);
		const vertical = widthAt(flat(line(200, 20, 200, 280)), 0, 0.5);
		expect(vertical).toBeGreaterThan(horizontal * 3);
	});

	it("马克笔每条笔画独立成批：不同笔画重叠叠色，同一笔自身不叠", () => {
		const cross = draw(
			scene([
				{ id: "a", path: line(50, 150, 350, 150) },
				{ id: "b", path: line(200, 30, 200, 270) },
			]),
			{ style: { hand: ruler, pen: pens.marker } },
		);
		for (const item of cross.items) {
			expect(item.batches).toHaveLength(1);
			expect(item.batches[0].opacity).toBeLessThan(1);
		}
		const closed = draw(scene([{ id: "r", path: rect(50, 50, 200, 120) }]), {
			style: { hand: createHand({ breakChance: 1 }), pen: pens.marker },
		});
		const batches = closed.items[0].batches;
		expect(batches.length).toBeGreaterThan(1);
		for (const b of batches) expect(b.verbs.filter((v) => v === 0)).toHaveLength(1);
	});

	it("短直线也有起收笔渐变，中段不被两端的低压抹平", () => {
		const drawing = draw(scene([{ id: "l", path: line(20, 100, 80, 100) }]), {
			style: inkpen,
			width: 3,
		});
		const [batch] = drawing.items[0].batches;
		expect(widthAt(batch, 0, 0.5)).toBeGreaterThan(widthAt(batch, 0, 0.02) * 2.5);
	});

	it("马克笔的压感强度可调：越大起收笔越细", () => {
		const ratio = (pressure?: number) => {
			const drawing = draw(scene([{ id: "l", path: line(20, 100, 380, 100) }]), {
				style: { hand: ruler, pen: createMarker({ pressure }) },
				width: 3,
			});
			const [batch] = drawing.items[0].batches;
			return widthAt(batch, 0, 0.01) / widthAt(batch, 0, 0.5);
		};
		expect(ratio()).toBeGreaterThan(0.8);
		expect(ratio(0)).toBeCloseTo(1, 2);
		expect(ratio(0.9)).toBeLessThan(0.4);
	});

	it("钢笔的压感强度可调：0 时恒宽，缺省时起收笔收尖", () => {
		const ratio = (pressure?: number) => {
			const drawing = draw(scene([{ id: "l", path: line(20, 100, 380, 100) }]), {
				style: { hand: ruler, pen: createInkPen({ pressure }) },
				width: 3,
			});
			const [batch] = drawing.items[0].batches;
			return widthAt(batch, 0, 0.01) / widthAt(batch, 0, 0.5);
		};
		expect(ratio(0)).toBeCloseTo(1, 2);
		expect(ratio()).toBeLessThan(0.4);
	});

	it("内置笔以 pressure 标明压感强度，工厂按同一参数调节", () => {
		expect(Object.values(pens).map((pen) => pen.pressure)).toEqual([0, 0.92, 0.15, 0.95]);
		const factories: PenFactory[] = [createFineliner, createInkPen, createMarker, createGPen];
		for (const factory of factories) {
			expect(factory().pressure).toBeTypeOf("number");
			expect(factory({ pressure: 0.5 }).pressure).toBe(0.5);
		}
	});

	it("G 笔的粗细对比强于钢笔：轻压更细，重压更粗", () => {
		const widths = (pen: ReturnType<PenFactory>) => {
			const drawing = draw(scene([{ id: "l", path: line(20, 100, 380, 100) }]), {
				style: { hand: ruler, pen },
				width: 3,
			});
			const [batch] = drawing.items[0].batches;
			return { thin: widthAt(batch, 0, 0.03), full: widthAt(batch, 0, 0.5) };
		};
		const g = widths(createGPen({ weight: 1 }));
		const ink = widths(createInkPen({ weight: 1, pressure: 0.95 }));
		expect(g.full).toBeGreaterThan(ink.full);
		expect(g.thin / g.full).toBeLessThan(ink.thin / ink.full);
	});

	it("扩展的条带笔自动响应压感强度，0 时恒宽", () => {
		const brush = (pressure?: number) =>
			createRibbonPen({ id: "brush", weight: 2, minScale: 0.1, maxScale: 1.4, pressure });
		expect(brush().pressure).toBe(1);
		const drawing = draw(scene([{ id: "l", path: line(20, 100, 380, 100) }]), {
			style: { hand: ruler, pen: brush(0) },
		});
		const [batch] = drawing.items[0].batches;
		expect(widthAt(batch, 0, 0.01) / widthAt(batch, 0, 0.5)).toBeCloseTo(1, 2);
	});

	it("条带两端有圆帽，轮廓闭合", () => {
		const drawing = draw(scene([{ id: "l", path: line(20, 100, 380, 100) }]), {
			style: inkpen,
		});
		const [batch] = drawing.items[0].batches;
		expect(batch.verbs[batch.verbs.length - 1]).toBe(3);
		expect(batch.ribbons?.[1]).toBeGreaterThan(0);
	});
});

describe("动漫风格", () => {
	const plain = { paper: "#fffdf7", ink: "#4a3431", sky: "#b9dbea" };
	const ring = (r: number) =>
		draw(scene([{ id: "c", path: circle(200, 150, r), fillRole: "sky" }]), {
			style: animeStyle,
			width: 3,
		}).items[0].batches;

	it("平涂取填充角色，排线与线稿同墨，不依赖派生色", () => {
		const batches = ring(80);
		expect(batches.map((b) => b.role)).toEqual(["sky", "ink", "ink"]);
		expect(batches[0].opacity).toBeUndefined();
		// 配色只给基础色即可渲染，缺少角色时 paint 会抛错
		const drawing = draw(scene([{ id: "c", path: circle(200, 150, 80), fillRole: "sky" }]), {
			style: animeStyle,
		});
		expect(renderSvg(drawing, plain)).toContain('data-role="sky"');
	});

	it("平涂朝背光侧错位并裁剪到原形状，朝光侧露出纸白", () => {
		const [wash] = ring(80);
		expect(wash.clip).toBeDefined();
		let minX = Number.POSITIVE_INFINITY;
		let minY = Number.POSITIVE_INFINITY;
		for (let i = 0; i < wash.coords.length; i += 2) {
			minX = Math.min(minX, wash.coords[i]);
			minY = Math.min(minY, wash.coords[i + 1]);
		}
		// 光来自左上，色块整体右下移，左上缘离开线稿
		expect(minX).toBeGreaterThan(120.5);
		expect(minY).toBeGreaterThan(70.5);
	});

	it("淡彩填充自带排线颜色，换哪支笔排线都取 ink", () => {
		const drawing = draw(scene([{ id: "c", path: circle(200, 150, 80), fillRole: "sky" }]), {
			style: { ...styles.natural, fill: createWashFill() },
			width: 3,
		});
		expect(drawing.items[0].batches.map((b) => b.role)).toEqual(["sky", "ink", "ink"]);
	});

	it("较小的图形只上色不画排线", () => {
		expect(ring(15).map((b) => b.role)).toEqual(["sky", "ink"]);
	});

	it("长线由多段短笔接成", () => {
		const drawing = draw(scene([{ id: "l", path: line(20, 100, 380, 100) }]), {
			style: animeStyle,
		});
		const [outline] = drawing.items[0].batches;
		expect(outline.verbs.filter((v) => v === 0).length).toBeGreaterThanOrEqual(4);
	});

	it("线稿用钢笔，压感强度可调，0 时恒宽", () => {
		const taper = (pressure?: number) => {
			const drawing = draw(scene([{ id: "l", path: line(20, 100, 380, 100) }]), {
				style: createAnimeStyle({ pressure }),
				width: 3,
			});
			const [outline] = drawing.items[0].batches;
			return widthAt(outline, 0, 0.02) / widthAt(outline, 0, 0.5);
		};
		expect(taper()).toBeLessThan(0.4);
		expect(taper(0)).toBeCloseTo(1, 2);
	});
});

describe("图元线宽", () => {
	it("线宽可按图元覆盖", () => {
		const drawing = draw(
			scene([
				{ id: "thick", path: line(20, 50, 380, 50), lineWidth: 6 },
				{ id: "thin", path: line(20, 100, 380, 100), lineWidth: 1 },
			]),
			{ style: styles.natural },
		);
		expect(drawing.items[0].batches[0].width).toBe(6);
		expect(drawing.items[1].batches[0].width).toBe(1);
	});
});

export type { Drawing };
