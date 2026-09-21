import { oklchToRgb } from "@shared/lib/color-math";
import { describe, expect, it } from "vitest";
import { tokenColorToHex } from "../probe";

describe("tokenColorToHex", () => {
	it("oklch 原始值经纯数学换算为 7 位 hex", () => {
		const hex = tokenColorToHex("oklch(0.53 0.205 286)");
		expect(hex).toMatch(/^#[0-9a-f]{6}$/);
		expect(hex).toBe(oklchToRgb(0.53, 0.205, 286).hex);
	});

	it("带透明度的 oklch 输出 8 位 hex", () => {
		expect(tokenColorToHex("oklch(0.5 0.1 286 / 0.5)")).toMatch(/^#[0-9a-f]{8}$/);
	});

	it("hex 输入短路原样返回", () => {
		expect(tokenColorToHex("#1da1f2")).toBe("#1da1f2");
	});

	it("空值返回 null", () => {
		expect(tokenColorToHex("")).toBeNull();
		expect(tokenColorToHex("   ")).toBeNull();
	});
});
