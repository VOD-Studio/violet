import { normalizeTheme } from "@violetjs/theme";
import { afterEach, describe, expect, it } from "vitest";

import {
	DECORATION_COOKIE_NAME,
	getClientDecoration,
	parseDecorationCookie,
	persistDecorationPreference,
	resolveDecoration,
} from "../decoration-preference";

describe("parseDecorationCookie", () => {
	const cookie = (value: string) => `appearance=dark; ${DECORATION_COOKIE_NAME}=${value}; x=1`;

	it.each([
		"theme",
		"none",
		"spring",
		"summer",
		"autumn",
		"winter",
	] as const)("读出 %s", (value) => {
		expect(parseDecorationCookie(cookie(value))).toBe(value);
	});

	it.each([
		["缺少 cookie", "appearance=dark"],
		["未知值", cookie("sakura")],
		["空值", cookie("")],
		["大小写不符", cookie("Spring")],
	])("%s时回落为跟随主题", (_, value) => {
		expect(parseDecorationCookie(value)).toBe("theme");
	});
});

describe("resolveDecoration", () => {
	const preset = { preset: "autumn" as const, custom: null };
	const custom = {
		preset: "autumn" as const,
		custom: normalizeTheme({ version: 1, seed: "#2b6cb0" }),
	};

	it("跟随主题时取预设主题的季节", () => {
		expect(resolveDecoration("theme", preset)).toBe("autumn");
	});

	it("自定义主题没有对应季节，跟随主题时不显示", () => {
		expect(resolveDecoration("theme", custom)).toBeNull();
	});

	it("指定季节时与主题无关，自定义主题也能另选", () => {
		expect(resolveDecoration("winter", preset)).toBe("winter");
		expect(resolveDecoration("spring", custom)).toBe("spring");
	});

	it("关闭时不显示", () => {
		expect(resolveDecoration("none", preset)).toBeNull();
	});
});

describe("客户端装饰偏好", () => {
	afterEach(() => {
		// biome-ignore lint/suspicious/noDocumentCookie: jsdom 的 cookie jar 模拟浏览器偏好
		document.cookie = `${DECORATION_COOKIE_NAME}=; path=/; Max-Age=0`;
	});

	it("写入后路由能读回", async () => {
		expect(getClientDecoration()).toBe("theme");
		await persistDecorationPreference("none");
		expect(getClientDecoration()).toBe("none");
		await persistDecorationPreference("summer");
		expect(getClientDecoration()).toBe("summer");
	});
});
