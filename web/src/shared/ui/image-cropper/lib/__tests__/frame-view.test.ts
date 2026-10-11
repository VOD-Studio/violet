import { describe, expect, it } from "vitest";
import { MAX_ZOOM, panView, viewToRect, zoomView } from "../frame-view";

const wide = { w: 2000, h: 1000 }; // 2:1
const tall = { w: 1000, h: 2000 };
const square = { w: 1000, h: 1000 };

describe("viewToRect", () => {
	it("zoom=1：宽图按高度铺满、窄图按宽度铺满，选区比例等于取景比例", () => {
		for (const [natural, aspect] of [
			[wide, 3],
			[tall, 3],
			[square, 3],
			[square, 1],
		] as const) {
			const r = viewToRect({ cx: 0.5, cy: 0.5, zoom: 1 }, natural, aspect);
			expect((r.w * natural.w) / (r.h * natural.h)).toBeCloseTo(aspect);
			expect(Math.max(r.w, r.h)).toBeCloseTo(1);
		}
	});

	it("中心被夹住，选区不越界", () => {
		const r = viewToRect({ cx: 0, cy: 2, zoom: 2 }, square, 1);
		expect(r.x).toBe(0);
		expect(r.y + r.h).toBeCloseTo(1);
	});

	it("缩放倍数被限制在上限内", () => {
		const r = viewToRect({ cx: 0.5, cy: 0.5, zoom: 99 }, square, 1);
		expect(r.w).toBeCloseTo(1 / MAX_ZOOM);
	});
});

describe("panView", () => {
	it("向右拖图，视野中心向左；zoom=1 且比例一致时无法平移", () => {
		const zoomed = { cx: 0.5, cy: 0.5, zoom: 2 };
		const moved = panView(zoomed, square, 1, { x: 50, y: 0 }, { w: 200, h: 200 });
		expect(moved.cx).toBeLessThan(0.5);
		const locked = panView(
			{ cx: 0.5, cy: 0.5, zoom: 1 },
			square,
			1,
			{ x: 80, y: 80 },
			{ w: 200, h: 200 },
		);
		expect(locked.cx).toBeCloseTo(0.5);
		expect(locked.cy).toBeCloseTo(0.5);
	});

	it("方形图放进 3:1 框：只能上下平移", () => {
		const view = { cx: 0.5, cy: 0.5, zoom: 1 };
		const moved = panView(view, square, 3, { x: 40, y: 20 }, { w: 300, h: 100 });
		expect(moved.cx).toBeCloseTo(0.5);
		expect(moved.cy).toBeLessThan(0.5);
	});
});

describe("zoomView", () => {
	it("以锚点缩放时锚点下的图像位置不变", () => {
		const view = { cx: 0.4, cy: 0.5, zoom: 2 };
		const anchor = { x: 0.8, y: 0.3 };
		const before = viewToRect(view, wide, 3);
		const next = zoomView(view, wide, 3, 3, anchor);
		const after = viewToRect(next, wide, 3);
		expect(after.x + anchor.x * after.w).toBeCloseTo(before.x + anchor.x * before.w, 4);
		expect(after.y + anchor.y * after.h).toBeCloseTo(before.y + anchor.y * before.h, 4);
	});
});
