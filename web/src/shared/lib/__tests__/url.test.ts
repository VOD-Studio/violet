/**
 * validateUrl 校验测试。
 *
 * 核心回归：WHATWG URL 解析器对 `https://wwww..,.,.` 这类非法域名不报错，
 * validateUrl 需通过 hostname 合法性校验拦截。
 */
import { describe, expect, it } from "vitest";
import { isImageURL, urlErrorMessage, validateUrl } from "../url";

describe("validateUrl", () => {
	it("合法 http/https URL 通过", () => {
		expect(validateUrl("https://example.com")).toBeNull();
		expect(validateUrl("http://example.com/path?q=1")).toBeNull();
		expect(validateUrl("https://blog.example.co.uk/a/b#c")).toBeNull();
	});

	it("localhost 通过", () => {
		expect(validateUrl("http://localhost:3000")).toBeNull();
		expect(validateUrl("https://localhost")).toBeNull();
	});

	it("合法 IPv4 通过", () => {
		expect(validateUrl("http://192.168.1.1")).toBeNull();
		expect(validateUrl("https://10.0.0.1:8080/x")).toBeNull();
	});

	it("合法 IPv6 通过（含方括号与 ::）", () => {
		expect(validateUrl("http://[::1]:8080")).toBeNull();
		expect(validateUrl("https://[2001:db8::1]/")).toBeNull();
	});

	it("空输入返回 empty", () => {
		expect(validateUrl("")).toBe("empty");
		expect(validateUrl("   ")).toBe("empty");
	});

	it("无法解析的输入返回 malformed", () => {
		expect(validateUrl("不是网址")).toBe("malformed");
		expect(validateUrl("example.com")).toBe("malformed");
		expect(validateUrl("//example.com")).toBe("malformed");
	});

	it("http:// 与 https:// 空域名返回 host 或 malformed", () => {
		// http:// / https:// WHATWG 会抛错
		expect(validateUrl("http://")).toBe("malformed");
		expect(validateUrl("https://")).toBe("malformed");
	});

	it("非 http/https 协议返回 scheme", () => {
		expect(validateUrl("ftp://example.com")).toBe("scheme");
		expect(validateUrl("javascript:alert(1)")).toBe("scheme");
		expect(validateUrl("file:///etc/passwd")).toBe("scheme");
	});

	it("非法域名结构返回 host（核心回归）", () => {
		// WHATWG new URL 不报错，但域名结构非法
		expect(validateUrl("https://wwww..,.,.")).toBe("host");
		expect(validateUrl("https://...")).toBe("host");
		expect(validateUrl("https://-bad.example.com")).toBe("host");
		expect(validateUrl("https://example")).toBe("host"); // 无 TLD
	});

	it("IPv4 各段越界返回 malformed（WHATWG 解析器自身拦截）", () => {
		// WHATWG URL 解析器对点分十进制 IPv4 host 做严格校验，越界直接抛错
		expect(validateUrl("http://256.1.1.1")).toBe("malformed");
		expect(validateUrl("http://1.2.3.999")).toBe("malformed");
	});
});

describe("isImageURL", () => {
	it("http/https 远程地址识别为图片", () => {
		expect(isImageURL("https://example.com/a.png")).toBe(true);
		expect(isImageURL("http://localhost:3000/a.jpg")).toBe(true);
	});

	it("以 / 开头的本地绝对路径识别为图片", () => {
		expect(isImageURL("/uploads/emojis/a.png")).toBe(true);
		expect(isImageURL("/files/emojis/a.png")).toBe(true);
	});

	it("颜文字等文本内容不识别为图片", () => {
		expect(isImageURL("(=・ω・=)")).toBe(false);
		expect(isImageURL("hello")).toBe(false);
		expect(isImageURL("")).toBe(false);
	});
});

describe("urlErrorMessage", () => {
	it("null 原因返回 null", () => {
		expect(urlErrorMessage(null)).toBeNull();
	});

	it("每种失败原因都有中文文案", () => {
		expect(urlErrorMessage("empty")).toBe("请输入 URL");
		expect(urlErrorMessage("malformed")).toBe("请输入合法的 URL");
		expect(urlErrorMessage("scheme")).toBe("仅支持 http/https 链接");
		expect(urlErrorMessage("host")).toBe("请输入合法的域名或 IP");
	});
});
