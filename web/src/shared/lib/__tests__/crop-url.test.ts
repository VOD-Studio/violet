import { describe, expect, it } from "vitest";
import { parseCrop, withCrop } from "../crop-url";

describe("withCrop", () => {
	it("给裸 path 附加 crop 参数", () => {
		expect(withCrop("/uploads/a.gif", { x: 0.1, y: 0.2, w: 0.5, h: 0.6 })).toBe(
			"/uploads/a.gif?crop=0.1,0.2,0.5,0.6",
		);
	});

	it("保留已有查询参数", () => {
		expect(withCrop("/uploads/a.gif?w=200", { x: 0.1, y: 0.2, w: 0.5, h: 0.6 })).toBe(
			"/uploads/a.gif?w=200&crop=0.1,0.2,0.5,0.6",
		);
	});

	it("覆盖已有 crop 参数(幂等)", () => {
		const once = withCrop("/uploads/a.gif", { x: 0.1, y: 0.2, w: 0.5, h: 0.6 });
		expect(withCrop(once, { x: 0, y: 0, w: 1, h: 1 })).toBe("/uploads/a.gif?crop=0,0,1,1");
	});

	it("四舍六入到 4 位小数", () => {
		expect(withCrop("/uploads/a.gif", { x: 0.123456, y: 0.00001, w: 0.999999, h: 0.5 })).toBe(
			"/uploads/a.gif?crop=0.1235,0,1,0.5",
		);
	});
});

describe("parseCrop", () => {
	it("解析有 crop 参数的 URL", () => {
		expect(parseCrop("/uploads/a.gif?crop=0.1,0.2,0.5,0.6")).toEqual({
			x: 0.1,
			y: 0.2,
			w: 0.5,
			h: 0.6,
		});
	});

	it("URL 有其他参数时仍能解析", () => {
		expect(parseCrop("/uploads/a.gif?w=200&crop=0.1,0.2,0.5,0.6")).toEqual({
			x: 0.1,
			y: 0.2,
			w: 0.5,
			h: 0.6,
		});
	});

	it("无 crop 参数返回 null", () => {
		expect(parseCrop("/uploads/a.gif?w=200")).toBeNull();
	});

	it("无查询字符串返回 null", () => {
		expect(parseCrop("/uploads/a.gif")).toBeNull();
	});

	it("非法 crop 值返回 null", () => {
		expect(parseCrop("/uploads/a.gif?crop=abc")).toBeNull();
	});

	it("分量不足返回 null", () => {
		expect(parseCrop("/uploads/a.gif?crop=0.1,0.2,0.5")).toBeNull();
	});

	it("超界值返回 null", () => {
		expect(parseCrop("/uploads/a.gif?crop=1.5,0,0.5,0.5")).toBeNull();
	});

	it("零宽高返回 null", () => {
		expect(parseCrop("/uploads/a.gif?crop=0.5,0.5,0,0.5")).toBeNull();
	});
});
