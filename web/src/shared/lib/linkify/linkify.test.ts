import { describe, expect, it } from "vitest";
import { displayUrl, tokenizeLinks } from "./linkify";

describe("tokenizeLinks", () => {
	it("识别 http/https 并剥离尾部句号", () => {
		const text = "看这篇 https://example.com/a。";
		const m = tokenizeLinks(text);
		expect(m).toHaveLength(1);
		expect(m[0].text).toBe("https://example.com/a");
		expect(m[0].href).toBe("https://example.com/a");
		expect(text.slice(m[0].start, m[0].end)).toBe(m[0].text);
	});

	it("中文路径完整保留", () => {
		const m = tokenizeLinks("https://example.com/文章/第一篇?q=关键词");
		expect(m[0].text).toBe("https://example.com/文章/第一篇?q=关键词");
	});

	it("www 前缀补 https 协议", () => {
		const m = tokenizeLinks("去 www.example.com/x 看看");
		expect(m[0].text).toBe("www.example.com/x");
		expect(m[0].href).toBe("https://www.example.com/x");
	});

	it("www 前是 URL 字符时不误起（awww.example.com 不是链接）", () => {
		expect(tokenizeLinks("awww.example.com")).toHaveLength(0);
	});

	it("括号包裹的链接右括号剥离、左括号不吞", () => {
		const m = tokenizeLinks("(https://example.com/a)");
		expect(m[0].text).toBe("https://example.com/a");
	});

	it("多链接保序且互不吞并", () => {
		const m = tokenizeLinks("先 https://a.example/1 再 https://b.example/2");
		expect(m.map((x) => x.text)).toEqual(["https://a.example/1", "https://b.example/2"]);
	});

	it("URL 内 fragment 的 # 不与话题标记冲突", () => {
		const m = tokenizeLinks("https://example.com/a#sec1");
		expect(m[0].text).toBe("https://example.com/a#sec1");
	});

	it("裸域名与 javascript: 不识别", () => {
		expect(tokenizeLinks("example.com/a")).toHaveLength(0);
		expect(tokenizeLinks("javascript:alert(1)")).toHaveLength(0);
	});

	it("大写协议识别", () => {
		const m = tokenizeLinks("HTTPS://EXAMPLE.COM/A");
		expect(m[0].text).toBe("HTTPS://EXAMPLE.COM/A");
	});

	it("无主机（https:///path）不识别", () => {
		expect(tokenizeLinks("https:///only-path")).toHaveLength(0);
	});

	it("无链接文本返回空数组", () => {
		expect(tokenizeLinks("今天天气不错 #话题#")).toHaveLength(0);
	});
});

describe("displayUrl", () => {
	it("不超长原样返回", () => {
		expect(displayUrl("https://example.com/a")).toBe("https://example.com/a");
	});

	it("超长头尾保留中间省略", () => {
		const raw = `https://example.com/${"x".repeat(80)}`;
		const out = displayUrl(raw);
		expect(out.startsWith("https://example.com/")).toBe(true);
		expect(out).toContain("…");
		expect(out.length).toBeLessThan(raw.length);
		expect(out.endsWith(raw.slice(-20))).toBe(true);
	});
});
