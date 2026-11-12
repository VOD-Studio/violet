// @vitest-environment node
import { describe, expect, it } from "vitest";
import { anonymousRenderVariant } from "../visitor-cookies";

describe("匿名访客的渲染变体", () => {
	it("名单外的 cookie 可能是会话，带着它的请求不算匿名", () => {
		expect(anonymousRenderVariant("violet_session=abc")).toBeNull();
		// 部署可以给会话 cookie 改名，不认识的名字一律按会话处理
		expect(anonymousRenderVariant("appearance=dark; renamed_session=abc")).toBeNull();
		// 登录时下发、登出才清除的用户标识
		expect(anonymousRenderVariant("violet_uid=42")).toBeNull();
	});

	it("首访读者与只带 CSRF、站点印象令牌的游客渲染结果相同", () => {
		expect(anonymousRenderVariant("")).toBe("");
		expect(anonymousRenderVariant("violet_csrf=t0ken; violet_impression=device")).toBe("");
	});

	it("外观、主题与装饰偏好不同的游客各有各的变体", () => {
		const variants = [
			"",
			"appearance=dark",
			"theme=dark",
			"theme-preference=%7B%22v%22%3A1%2C%22preference%22%3A%22winter%22%7D",
			"decoration-preference=none",
			"decoration-layers=particles",
		].map(anonymousRenderVariant);
		expect(variants).not.toContain(null);
		expect(new Set(variants).size).toBe(variants.length);
	});

	it("同一组偏好不因 cookie 先后顺序或夹带的匿名令牌分成两个变体", () => {
		expect(
			anonymousRenderVariant("decoration-preference=none; violet_csrf=a; appearance=dark"),
		).toBe(anonymousRenderVariant("appearance=dark; decoration-preference=none"));
	});
});
