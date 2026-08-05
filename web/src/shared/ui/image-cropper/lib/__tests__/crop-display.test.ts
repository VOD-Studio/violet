/**
 * coverCropTransform 纯几何测试
 *
 * 契约:选区当作图片 object-fit:cover 进容器——
 * - 选区宽高比 == 容器宽高比:选区四边精确贴合容器(精确复现)
 * - 不一致:选区铺满容器,溢出维度居中裁切(选区中心 == 可见窗口中心)
 *
 * 可见窗口反解独立于实现,不共享代码。
 */
import { describe, expect, it } from "vitest";
import type { CropRect } from "../../types";
import { type CropTransform, coverCropTransform, type Size } from "../crop-display";

/** 由变换反解容器内可见的归一化图片区域(带边界截断) */
function visibleWindow(t: CropTransform, box: Size): CropRect {
	const x = Math.min(Math.max(-t.left / t.width, 0), 1);
	const y = Math.min(Math.max(-t.top / t.height, 0), 1);
	const r = Math.min(Math.max((box.w - t.left) / t.width, 0), 1);
	const b = Math.min(Math.max((box.h - t.top) / t.height, 0), 1);
	return { x, y, w: r - x, h: b - y };
}

function expectWindow(actual: CropRect, expected: CropRect) {
	expect(actual.x).toBeCloseTo(expected.x, 3);
	expect(actual.y).toBeCloseTo(expected.y, 3);
	expect(actual.w).toBeCloseTo(expected.w, 3);
	expect(actual.h).toBeCloseTo(expected.h, 3);
}

/** 竖版 GIF(480x800) */
const PORTRAIT: Size = { w: 480, h: 800 };
/** 横版静态图(800x480) */
const LANDSCAPE: Size = { w: 800, h: 480 };

describe("coverCropTransform", () => {
	it("用户场景:竖图 16/9 全宽选区在 16/9 容器中精确复现", () => {
		// h = (9/16) * (480/800) = 0.3375
		const rect: CropRect = { x: 0, y: 0.5, w: 1, h: 0.3375 };
		const box: Size = { w: 800, h: 450 };
		const t = coverCropTransform(rect, PORTRAIT, box);
		expect(t).not.toBeNull();
		expectWindow(visibleWindow(t as CropTransform, box), rect);
	});

	it("竖图 16/9 局部选区在 16/9 容器中精确复现", () => {
		const rect: CropRect = { x: 0.25, y: 0.4, w: 0.5, h: 0.16875 };
		const box: Size = { w: 800, h: 450 };
		const t = coverCropTransform(rect, PORTRAIT, box);
		expect(t).not.toBeNull();
		expectWindow(visibleWindow(t as CropTransform, box), rect);
	});

	it("容器比选区宽:水平精确,垂直以选区中心居中裁切", () => {
		// 16/9 选区放进 2/1 容器:垂直溢出,窗口中心保持选区中心
		const rect: CropRect = { x: 0, y: 0.5, w: 1, h: 0.3375 };
		const box: Size = { w: 800, h: 400 };
		const t = coverCropTransform(rect, PORTRAIT, box);
		expect(t).not.toBeNull();
		// scale = 800/480 → 可见 h = 400/(800*scale) = 0.3,中心 y = 0.66875
		expectWindow(visibleWindow(t as CropTransform, box), {
			x: 0,
			y: 0.51875,
			w: 1,
			h: 0.3,
		});
	});

	it("容器比选区高:垂直精确,水平以选区中心居中裁切", () => {
		// 横图 800x480 上的 1:1 选区(w=0.3 → h=0.5),放进 450x800 竖容器
		const rect: CropRect = { x: 0.35, y: 0.25, w: 0.3, h: 0.5 };
		const box: Size = { w: 450, h: 800 };
		const t = coverCropTransform(rect, LANDSCAPE, box);
		expect(t).not.toBeNull();
		// scale = 800/240 → 可见 w = 450/(800*scale) = 0.16875,中心 x = 0.5
		expectWindow(visibleWindow(t as CropTransform, box), {
			x: 0.415625,
			y: 0.25,
			w: 0.16875,
			h: 0.5,
		});
	});

	it("全图选区退化为普通 cover 居中", () => {
		const rect: CropRect = { x: 0, y: 0, w: 1, h: 1 };
		const box: Size = { w: 800, h: 450 };
		const t = coverCropTransform(rect, PORTRAIT, box);
		expect(t).not.toBeNull();
		// 标准 cover:竖图在宽容器中水平满幅,垂直居中,可见 h = 450/(800*scale)=0.3375
		expectWindow(visibleWindow(t as CropTransform, box), {
			x: 0,
			y: 0.33125,
			w: 1,
			h: 0.3375,
		});
	});

	it("非法输入返回 null", () => {
		const rect: CropRect = { x: 0, y: 0.5, w: 1, h: 0.3375 };
		const box: Size = { w: 800, h: 450 };
		expect(coverCropTransform({ ...rect, w: 0 }, PORTRAIT, box)).toBeNull();
		expect(coverCropTransform(rect, { w: 0, h: 800 }, box)).toBeNull();
		expect(coverCropTransform(rect, PORTRAIT, { w: 800, h: 0 })).toBeNull();
	});
});
