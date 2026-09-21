import {
	getContrastRatio,
	getRelativeLuminance,
	getWcagRating,
	oklchToRgb,
	parseOklch,
} from "@features/lab/palette/model/color-math";
import { describe, expect, it } from "vitest";

describe("color-math", () => {
	describe("parseOklch", () => {
		it("成功解析标准 oklch 字符串", () => {
			const res = parseOklch("oklch(0.53 0.205 286)");
			expect(res).not.toBeNull();
			expect(res?.l).toBe(0.53);
			expect(res?.c).toBe(0.205);
			expect(res?.h).toBe(286);
			expect(res?.alpha).toBe(1);
		});

		it("成功解析带百分比透明度的 oklch 字符串", () => {
			const res = parseOklch("oklch(0.92 0.012 286 / 12%)");
			expect(res).not.toBeNull();
			expect(res?.l).toBe(0.92);
			expect(res?.c).toBe(0.012);
			expect(res?.h).toBe(286);
			expect(res?.alpha).toBeCloseTo(0.12);
		});

		it("非法格式返回 null", () => {
			expect(parseOklch("rgb(255, 0, 0)")).toBeNull();
			expect(parseOklch("invalid")).toBeNull();
			expect(parseOklch("")).toBeNull();
		});
	});

	describe("oklchToRgb", () => {
		it("正确将纯白与纯黑转换为 sRGB", () => {
			const white = oklchToRgb(1, 0, 0);
			expect(white.hex.toLowerCase()).toBe("#ffffff");
			expect(white.r).toBe(255);
			expect(white.g).toBe(255);
			expect(white.b).toBe(255);

			const black = oklchToRgb(0, 0, 0);
			expect(black.hex.toLowerCase()).toBe("#000000");
			expect(black.r).toBe(0);
			expect(black.g).toBe(0);
			expect(black.b).toBe(0);
		});

		it("正确将紫罗兰浅色品牌主色转换为预期 Hex", () => {
			const brandLight = oklchToRgb(0.53, 0.205, 286);
			expect(brandLight.hex.toLowerCase()).toBe("#684dda");
		});

		it("正确将紫罗兰深色品牌主色转换为预期 Hex", () => {
			const brandDark = oklchToRgb(0.72, 0.148, 286);
			expect(brandDark.hex.toLowerCase()).toBe("#9e95fc");
		});
	});

	describe("getRelativeLuminance", () => {
		it("纯黑相对亮度为 0，纯白为 1", () => {
			expect(getRelativeLuminance(0, 0, 0)).toBe(0);
			expect(getRelativeLuminance(1, 1, 1)).toBeCloseTo(1);
		});
	});

	describe("getContrastRatio", () => {
		it("白底黑字对比度为 21:1", () => {
			const ratio = getContrastRatio("oklch(0 0 0)", "oklch(1 0 0)");
			expect(ratio).toBe(21);
		});

		it("同色对比度为 1:1", () => {
			const ratio = getContrastRatio("oklch(0.5 0.1 286)", "oklch(0.5 0.1 286)");
			expect(ratio).toBe(1);
		});

		it("紫罗兰品牌浅色在白瓷底色上的对比度大于 5:1 (符合 WCAG AA)", () => {
			const ratio = getContrastRatio("oklch(0.53 0.205 286)", "oklch(0.992 0.003 286)");
			expect(ratio).toBeGreaterThan(5.0);
		});

		it("紫罗兰品牌深色在黑曜星空底色上的对比度大于 5.5:1 (符合 WCAG AA)", () => {
			const ratio = getContrastRatio("oklch(0.72 0.148 286)", "oklch(0.138 0.012 286)");
			expect(ratio).toBeGreaterThan(5.5);
		});
	});

	describe("getWcagRating", () => {
		it(">= 7.0 评定为 AAA", () => {
			expect(getWcagRating(7.5)).toEqual({ rating: "AAA", isAccessible: true });
		});

		it(">= 4.5 评定为 AA", () => {
			expect(getWcagRating(5.2)).toEqual({ rating: "AA", isAccessible: true });
		});

		it(">= 3.0 评定为 AA Large", () => {
			expect(getWcagRating(3.5)).toEqual({
				rating: "AA Large",
				isAccessible: true,
			});
		});

		it("< 3.0 评定为 Fail", () => {
			expect(getWcagRating(2.1)).toEqual({ rating: "Fail", isAccessible: false });
		});
	});
});
