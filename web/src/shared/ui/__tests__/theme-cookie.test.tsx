/**
 * persistThemeCookie / SystemThemeTransition 测试
 *
 * 回归场景：Cookie Store API 只在安全上下文暴露，HTTP + 局域网 IP 访问与
 * Firefox/Safari 下全局 cookieStore 不存在，此前裸引用抛 ReferenceError，
 * 被路由错误边界接住，主题 cookie 也永远写不上（SSR 首帧闪白）。
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { persistThemeCookie, SystemThemeTransition } from "../theme-transition";

vi.mock("next-themes", () => ({
	useTheme: () => ({ theme: "dark", resolvedTheme: "dark", setTheme: vi.fn() }),
}));

/** 与 shared/server/theme.ts 的 getSSRTheme 同一套解析方式 */
const readThemeCookie = () => document.cookie.match(/(?:^|; )theme=([^;]*)/)?.[1];

const clearThemeCookie = () => {
	// biome-ignore lint/suspicious/noDocumentCookie: jsdom 无 Cookie Store API，测试只能用它清 cookie
	document.cookie = "theme=; path=/; Max-Age=0";
};

const stubCookieStore = (value: unknown) => {
	Object.defineProperty(globalThis, "cookieStore", { configurable: true, value });
};

const dropCookieStore = () => {
	Reflect.deleteProperty(globalThis, "cookieStore");
};

describe("persistThemeCookie", () => {
	afterEach(() => {
		clearThemeCookie();
		dropCookieStore();
	});

	it("无 Cookie Store API 时回落 document.cookie", () => {
		expect("cookieStore" in globalThis).toBe(false);
		persistThemeCookie("dark");
		expect(readThemeCookie()).toBe("dark");
	});

	it("有 Cookie Store API 时走 cookieStore.set", () => {
		const set = vi.fn().mockResolvedValue(undefined);
		stubCookieStore({ set });
		const before = Date.now();

		persistThemeCookie("light");

		expect(set).toHaveBeenCalledTimes(1);
		const init = set.mock.calls[0][0];
		expect(init.name).toBe("theme");
		expect(init.value).toBe("light");
		expect(init.path).toBe("/");
		expect(init.sameSite).toBe("lax");
		// expires 是 epoch ms，等价 max-age=31536000s（1 年）
		expect(init.expires).toBeGreaterThanOrEqual(before + 31536000_000);
	});

	it("cookieStore.set 被拒时不抛错", async () => {
		stubCookieStore({ set: vi.fn().mockRejectedValue(new Error("denied")) });
		expect(() => persistThemeCookie("dark")).not.toThrow();
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
});

describe("SystemThemeTransition", () => {
	afterEach(() => {
		cleanup();
		clearThemeCookie();
	});

	it("无 cookieStore 环境下挂载不抛错并写入主题 cookie", () => {
		expect(() => render(<SystemThemeTransition />)).not.toThrow();
		expect(readThemeCookie()).toBe("dark");
	});
});
