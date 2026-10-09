import { describe, expect, it } from "vitest";
import {
	cartoonPalette,
	cartoonStyle,
	circle,
	createHand,
	createInkPen,
	createMarker,
	type Drawing,
	draw,
	type InkBatch,
	line,
	parseColor,
	pens,
	rect,
	type SceneItem,
	shadeOf,
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

	it("压感钢笔的线宽随压力变化：两端收尖、中段最宽", () => {
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
			style: { hand: ruler, pen: styles.natural.pen && createInkPen(1) },
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

	it("条带两端有圆帽，轮廓闭合", () => {
		const drawing = draw(scene([{ id: "l", path: line(20, 100, 380, 100) }]), {
			style: inkpen,
		});
		const [batch] = drawing.items[0].batches;
		expect(batch.verbs[batch.verbs.length - 1]).toBe(3);
		expect(batch.ribbons?.[1]).toBeGreaterThan(0);
	});
});

describe("卡通风格", () => {
	const base = { paper: "#fffdf7", ink: "#2b2836", sky: "#b9dbea", sun: "#f2d38f" };

	it("阴影、高光与线色从基础色派生，不叠黑", () => {
		const palette = cartoonPalette(base);
		for (const role of ["sky", "sun"]) {
			expect(palette[`${role}:shade`]).toBeDefined();
			expect(palette[`${role}:light`]).toBeDefined();
			expect(palette[`${role}:line`]).toBeDefined();
		}
		expect(palette["paper:shade"]).toBeUndefined();
		// 阴影偏冷：色相更靠近蓝紫（285°）；明度下降且仍是同族颜色而非灰黑。
		const away = (h: number) => Math.abs(((((h - 285) % 360) + 540) % 360) - 180);
		const before = parseColor(base.sun);
		const after = parseColor(shadeOf(base.sun));
		expect(away(after.h)).toBeLessThan(away(before.h));
		expect(after.l).toBeLessThan(before.l);
		expect(after.c).toBeGreaterThan(before.c * 0.9);
	});

	it("填充输出底色、阴影与高光三层，线条取派生线色", () => {
		const drawing = draw(scene([{ id: "c", path: circle(200, 150, 80), fillRole: "sky" }]), {
			style: cartoonStyle,
			width: 3,
		});
		const roles = drawing.items[0].batches.map((b) => b.role);
		expect(roles).toEqual(["sky", "sky:shade", "sky:light", "sky:line"]);
		const svg = renderSvg(drawing, cartoonPalette(base));
		expect(svg).toContain('data-role="sky:shade"');
	});

	it("阴影形状由几何推导：大小随图形变化且被裁剪在图形内", () => {
		const shadowOf = (r: number) =>
			draw(scene([{ id: "c", path: circle(200, 150, r), fillRole: "sky" }]), {
				style: cartoonStyle,
			}).items[0].batches.find((b) => b.role === "sky:shade");
		const big = shadowOf(90);
		const small = shadowOf(30);
		expect(big?.clip).toBeDefined();
		expect(small?.clip).toBeDefined();
		expect(big?.coords.length).toBeGreaterThan(0);
		// 小于 14 的图形只上底色。
		expect(shadowOf(5)).toBeUndefined();
	});

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
