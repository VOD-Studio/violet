import { describe, expect, it } from "vitest";

import {
	parseThemeCookie,
	resolvePresetTheme,
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
