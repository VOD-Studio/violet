import { afterEach, describe, expect, it, vi } from "vitest";

import {
	getClientThemeState,
	parseCustomThemeCookie,
	parseThemeCookie,
	persistThemePreference,
	resolvePresetTheme,
	seasonMonths,
	serializeThemePreference,
	THEME_COOKIE_NAME,
} from "../theme-preference";

describe("resolvePresetTheme", () => {
	it.each([
		["2026-02-28T15:59:59Z", "winter"],
		["2026-02-28T16:00:00Z", "spring"],
		["2026-05-31T15:59:59Z", "spring"],
		["2026-05-31T16:00:00Z", "summer"],
		["2026-08-31T16:00:00Z", "autumn"],
		["2026-11-30T15:59:59Z", "autumn"],
		["2026-11-30T16:00:00Z", "winter"],
		["2027-01-15T04:00:00Z", "winter"],
	])("跟随季节按 Asia/Shanghai 的月份解析：%s → %s", (instant, season) => {
		expect(resolvePresetTheme("follow", new Date(instant))).toBe(season);
	});

	it("指定季节时不看日期", () => {
		expect(resolvePresetTheme("summer", new Date("2026-12-24T00:00:00Z"))).toBe("summer");
	});
});

describe("parseThemeCookie", () => {
	const cookie = (value: string) => `appearance=dark; ${THEME_COOKIE_NAME}=${value}; other=1`;

	it("读出版本化 cookie 中的季节", () => {
		expect(parseThemeCookie(cookie(encodeURIComponent('{"v":1,"theme":"summer"}')))).toBe(
			"summer",
		);
	});

	it.each([
		["缺少 cookie", "appearance=dark"],
		["缺少版本号", cookie(encodeURIComponent('{"theme":"summer"}'))],
		["旧版本", cookie(encodeURIComponent('{"v":0,"theme":"summer"}'))],
		["未来版本", cookie(encodeURIComponent('{"v":2,"theme":"summer"}'))],
		["未知主题", cookie(encodeURIComponent('{"v":1,"theme":"violet"}'))],
		["不是 JSON", cookie("summer")],
		["编码损坏", cookie("%E0%A4%A")],
		["不是对象", cookie(encodeURIComponent("[1]"))],
	])("%s时回落为跟随季节", (_, value) => {
		expect(parseThemeCookie(value)).toBe("follow");
	});

	it("写出的值能被读回", () => {
		expect(serializeThemePreference("winter")).toBe(
			encodeURIComponent('{"v":1,"theme":"winter"}'),
		);
		expect(parseThemeCookie(cookie(serializeThemePreference("autumn")))).toBe("autumn");
	});
});

describe("客户端主题状态", () => {
	afterEach(() => {
		delete document.documentElement.dataset.theme;
		delete document.documentElement.dataset.season;
		// biome-ignore lint/suspicious/noDocumentCookie: jsdom 的 cookie jar 模拟浏览器偏好
		document.cookie = `${THEME_COOKIE_NAME}=; path=/; Max-Age=0`;
		vi.unstubAllGlobals();
	});

	it("预设沿用首帧渲染的 data-theme，偏好来自 cookie", () => {
		document.documentElement.dataset.theme = "summer";
		// biome-ignore lint/suspicious/noDocumentCookie: jsdom 的 cookie jar 模拟浏览器偏好
		document.cookie = `${THEME_COOKIE_NAME}=${serializeThemePreference("follow")}; path=/`;
		expect(getClientThemeState()).toEqual({
			preference: "follow",
			preset: "summer",
			custom: null,
		});
	});

	it("自定义主题生效时季节取自首帧的 data-season", () => {
		document.documentElement.dataset.theme = "custom";
		document.documentElement.dataset.season = "winter";
		expect(getClientThemeState().preset).toBe("winter");
	});

	it("没有首帧主题时按 cookie 解析预设", () => {
		// biome-ignore lint/suspicious/noDocumentCookie: jsdom 的 cookie jar 模拟浏览器偏好
		document.cookie = `${THEME_COOKIE_NAME}=${serializeThemePreference("winter")}; path=/`;
		expect(getClientThemeState()).toEqual({
			preference: "winter",
			preset: "winter",
			custom: null,
		});
	});

	it("写入的偏好在下次读取时生效", async () => {
		vi.stubGlobal("cookieStore", undefined);
		await persistThemePreference("spring");
		expect(parseThemeCookie(document.cookie)).toBe("spring");
	});
});

describe("seasonMonths", () => {
	it.each([
		["spring", "3–5 月"],
		["summer", "6–8 月"],
		["autumn", "9–11 月"],
		["winter", "12–2 月"],
	] as const)("%s 显示为 %s", (season, label) => {
		expect(seasonMonths(season)).toBe(label);
	});
});

describe("自定义主题", () => {
	const cookie = (data: unknown) =>
		`${THEME_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(data))}`;
	const theme = { version: 1, seed: "#ff8800", knobs: { neutralChroma: 0.015 } } as const;

	it("读出规范化后的种子色与旋钮，同时保留原来的预设偏好", () => {
		const value = cookie({
			v: 1,
			theme: "winter",
			custom: { version: 1, seed: "#3A7BD5", knobs: { neutralChroma: 0.02 } },
		});
		expect(parseCustomThemeCookie(value)).toEqual({
			version: 1,
			seed: "#3a7bd5",
			knobs: { neutralChroma: 0.02 },
		});
		expect(parseThemeCookie(value)).toBe("winter");
	});

	it("丢弃未知旋钮，越界旋钮回落为默认值", () => {
		expect(
			parseCustomThemeCookie(
				cookie({
					v: 1,
					theme: "follow",
					custom: { version: 1, seed: "#3a7bd5", knobs: { neutralChroma: 9, glow: 1 } },
				}),
			),
		).toEqual({ version: 1, seed: "#3a7bd5", knobs: { neutralChroma: 0.015 } });
	});

	it.each([
		["没有自定义主题", undefined],
		["种子色非法", { version: 1, seed: "red" }],
		["种子色试图注入样式", { version: 1, seed: "#fff;}body{display:none" }],
		["主题版本不符", { version: 2, seed: "#3a7bd5" }],
	])("%s时不生效，回落为原来的预设偏好", (_, custom) => {
		const value = cookie({ v: 1, theme: "summer", custom });
		expect(parseCustomThemeCookie(value)).toBeNull();
		expect(parseThemeCookie(value)).toBe("summer");
	});

	it("cookie 版本不符时自定义主题也不生效", () => {
		expect(parseCustomThemeCookie(cookie({ v: 2, theme: "follow", custom: theme }))).toBeNull();
	});

	it("写出的自定义主题能被读回", () => {
		const value = `${THEME_COOKIE_NAME}=${serializeThemePreference("autumn", theme)}`;
		expect(parseCustomThemeCookie(value)).toEqual(theme);
		expect(parseThemeCookie(value)).toBe("autumn");
	});

	it("客户端状态带出自定义主题", () => {
		// biome-ignore lint/suspicious/noDocumentCookie: jsdom 的 cookie jar 模拟浏览器偏好
		document.cookie = `${THEME_COOKIE_NAME}=${serializeThemePreference("follow", theme)}; path=/`;
		expect(getClientThemeState().custom).toEqual(theme);
		// biome-ignore lint/suspicious/noDocumentCookie: jsdom 的 cookie jar 模拟浏览器偏好
		document.cookie = `${THEME_COOKIE_NAME}=; path=/; Max-Age=0`;
	});
});
