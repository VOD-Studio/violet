import { describe, expect, it } from "vitest";
import { safeRedirectTarget } from "../safe-redirect";

describe("safeRedirectTarget", () => {
	it("站内绝对路径放行", () => {
		expect(safeRedirectTarget("/tweets")).toBe("/tweets");
		expect(safeRedirectTarget("/")).toBe("/");
		expect(safeRedirectTarget("/blog/a?b=1#c")).toBe("/blog/a?b=1#c");
	});

	it("外部 URL 一律拒绝回首页", () => {
		expect(safeRedirectTarget("https://evil.com")).toBe("/");
		expect(safeRedirectTarget("http://evil.com/path")).toBe("/");
		expect(safeRedirectTarget("//evil.com")).toBe("/");
		// "/\\" 开头会被浏览器规范化为协议相对 URL
		expect(safeRedirectTarget("/\\evil.com")).toBe("/");
	});

	it("空值与相对路径拒绝回首页", () => {
		expect(safeRedirectTarget(undefined)).toBe("/");
		expect(safeRedirectTarget("")).toBe("/");
		expect(safeRedirectTarget("tweets")).toBe("/");
		expect(safeRedirectTarget("#anchor")).toBe("/");
	});
});
