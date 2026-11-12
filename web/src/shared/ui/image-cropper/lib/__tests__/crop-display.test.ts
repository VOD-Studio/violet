/**
 * 选区复现的纯几何测试
 *
 * 契约:选区当作图片 object-fit:cover 进容器——
 * - 选区宽高比 == 容器宽高比:选区四边精确贴合容器(精确复现)
 * - 不一致:选区铺满容器,溢出维度居中裁切(选区中心 == 可见窗口中心)
 *
 * 可见窗口反解独立于实现,不共享代码。
 */
import { describe, expect, it } from "vitest";
import type { CropRect } from "../../types";
import {
	type CropFrame,
	type CropTransform,
	coverCropFrame,
	coverCropTransform,
	type Size,
} from "../crop-display";

/** 由变换反解容器内可见的归一化图片区域(带边界截断) */
function visibleWindow(t: CropTransform, box: Size): CropRect {
	const x = Math.min(Math.max(-t.left / t.width, 0), 1);
	const y = Math.min(Math.max(-t.top / t.height, 0), 1);
	const r = Math.min(Math.max((box.w - t.left) / t.width, 0), 1);
	const b = Math.min(Math.max((box.h - t.top) / t.height, 0), 1);
	return { x, y, w: r - x, h: b - y };
}

/**
 * 按 CSS 规范模拟百分比 img 盒上的 object-fit:cover + object-position,
 * 反解容器内可见的归一化图片区域。图只画在 img 盒内,盒没盖住的容器部分是空白。
 */
function frameWindow(frame: CropFrame, natural: Size, box: Size): CropRect {
	const boxLeft = (box.w * frame.left) / 100;
	const boxTop = (box.h * frame.top) / 100;
	const boxWidth = (box.w * frame.width) / 100;
	const boxHeight = (box.h * frame.height) / 100;
	const scale = Math.max(boxWidth / natural.w, boxHeight / natural.h);
	const width = natural.w * scale;
	const height = natural.h * scale;
	const left = boxLeft + ((boxWidth - width) * frame.focusX) / 100;
	const top = boxTop + ((boxHeight - height) * frame.focusY) / 100;
	const x0 = Math.max(0, boxLeft);
	const y0 = Math.max(0, boxTop);
	const x1 = Math.min(box.w, boxLeft + boxWidth);
	const y1 = Math.min(box.h, boxTop + boxHeight);
	return {
		x: (x0 - left) / width,
		y: (y0 - top) / height,
		w: (x1 - x0) / width,
		h: (y1 - y0) / height,
	};
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
/** 横版封面原图(2000x1000) */
const WIDE: Size = { w: 2000, h: 1000 };

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

describe("coverCropFrame", () => {
	it("正中一半的选区:img 盒是容器的 2 倍,左上各退半个容器", () => {
		const rect: CropRect = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
		expect(coverCropFrame(rect)).toEqual({
			width: 200,
			height: 200,
			left: -50,
			top: -50,
			focusX: 50,
			focusY: 50,
		});
	});

	it("选区比例等于容器比例:四边贴合容器", () => {
		// 2000x1000 上的选区像素 1000x500,与 2:1 容器同比例
		const rect: CropRect = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
		expectWindow(frameWindow(coverCropFrame(rect), WIDE, { w: 920, h: 460 }), rect);
	});

	it("选区比容器宽:高度贴合,水平以选区中心居中裁切", () => {
		// 选区像素 1600x500 放进 800x400:按高缩放 0.8,可见宽 800/0.8 = 1000px = 0.5,中心 x = 0.5
		const rect: CropRect = { x: 0.1, y: 0.25, w: 0.8, h: 0.5 };
		expectWindow(frameWindow(coverCropFrame(rect), WIDE, { w: 800, h: 400 }), {
			x: 0.25,
			y: 0.25,
			w: 0.5,
			h: 0.5,
		});
	});

	it("选区比容器高:宽度贴合,垂直以选区中心居中裁切", () => {
		// 选区像素 1000x800 放进 800x400:按宽缩放 0.8,可见高 400/0.8 = 500px = 0.5,中心 y = 0.5
		const rect: CropRect = { x: 0.25, y: 0.1, w: 0.5, h: 0.8 };
		expectWindow(frameWindow(coverCropFrame(rect), WIDE, { w: 800, h: 400 }), {
			x: 0.25,
			y: 0.25,
			w: 0.5,
			h: 0.5,
		});
	});

	it("贴右下边的同比例选区:贴合容器且不露空白", () => {
		const rect: CropRect = { x: 0.5, y: 0.5, w: 0.5, h: 0.5 };
		expectWindow(frameWindow(coverCropFrame(rect), WIDE, { w: 920, h: 460 }), rect);
	});

	it("贴右边的异比例选区:右缘贴合容器,垂直居中裁切", () => {
		// 选区像素 800x1000 放进 800x400:按宽缩放 1,可见高 400px = 0.4,中心 y = 0.5
		const rect: CropRect = { x: 0.6, y: 0, w: 0.4, h: 1 };
		expectWindow(frameWindow(coverCropFrame(rect), WIDE, { w: 800, h: 400 }), {
			x: 0.6,
			y: 0.3,
			w: 0.4,
			h: 0.4,
		});
	});

	it("竖图 16/9 全宽选区放进 2/1 容器:水平精确,垂直居中裁切", () => {
		// 可见 h = 400/(800*800/480) = 0.3,中心 y = 0.66875
		const rect: CropRect = { x: 0, y: 0.5, w: 1, h: 0.3375 };
		expectWindow(frameWindow(coverCropFrame(rect), PORTRAIT, { w: 800, h: 400 }), {
			x: 0,
			y: 0.51875,
			w: 1,
			h: 0.3,
		});
	});

	it.each([360, 920, 1840])("容器宽 %ipx 时可见区域相同", (width) => {
		const rect: CropRect = { x: 0.25, y: 0.1, w: 0.5, h: 0.8 };
		expectWindow(frameWindow(coverCropFrame(rect), WIDE, { w: width, h: width / 2 }), {
			x: 0.25,
			y: 0.25,
			w: 0.5,
			h: 0.5,
		});
	});
});
