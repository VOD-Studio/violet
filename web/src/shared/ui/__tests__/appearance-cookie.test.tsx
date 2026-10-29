import {
	getClientAppearance,
	parseAppearanceCookie,
	persistAppearanceCookie,
} from "@shared/lib/appearance-cookie";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SystemAppearanceTransition } from "../appearance-transition";

let resolvedAppearance = "dark";

vi.mock("next-themes", () => ({
	useTheme: () => ({ theme: resolvedAppearance, resolvedTheme: resolvedAppearance }),
}));

function setCookie(value: string) {
	// biome-ignore lint/suspicious/noDocumentCookie: jsdom 使用 cookie jar 验证可观察的持久化结果
	document.cookie = value;
}

afterEach(() => {
	cleanup();
	for (const name of ["theme", "appearance"]) {
		setCookie(`${name}=; path=/; Max-Age=0`);
	}
	resolvedAppearance = "dark";
	vi.unstubAllGlobals();
});

describe("外观 cookie 解析", () => {
	it.each([
		["theme=dark", "dark", true],
		["theme=light", "light", true],
		["appearance=light; theme=dark", "light", false],
		["theme=light;appearance=dark", "dark", false],
		["appearance=; theme=dark", "light", false],
		["appearance=invalid; theme=dark", "light", false],
		["theme=system", "light", false],
		["other_appearance=dark; other_theme=dark", "light", false],
		["", "light", false],
	])("%s 解析为 %s，迁移=%s", (cookie, appearance, needsMigration) => {
		expect(parseAppearanceCookie(cookie)).toEqual({ appearance, needsMigration });
	});
});

describe("客户端外观 cookie", () => {
	it("只有旧 cookie 时读取旧值并补写新 cookie", () => {
		vi.stubGlobal("cookieStore", undefined);
		setCookie("theme=dark; path=/");

		expect(getClientAppearance()).toBe("dark");
		expect(document.cookie).toContain("appearance=dark");
		expect(parseAppearanceCookie(document.cookie).needsMigration).toBe(false);
	});

	it("新偏好存在时不会被旧 cookie 覆盖", () => {
		vi.stubGlobal("cookieStore", undefined);
		setCookie("theme=dark; path=/");
		setCookie("appearance=light; path=/");

		expect(getClientAppearance()).toBe("light");
		expect(document.cookie).toContain("appearance=light");
	});

	it("无 Cookie Store API 时仍可更新外观，旧 cookie 不再续写", () => {
		vi.stubGlobal("cookieStore", undefined);
		setCookie("theme=light; path=/");
		persistAppearanceCookie("dark");

		expect(getClientAppearance()).toBe("dark");
		expect(document.cookie).toContain("theme=light");
		expect(document.cookie).toContain("appearance=dark");
	});

	it("全局桥接随已解析外观变化同步 cookie", () => {
		vi.stubGlobal("cookieStore", undefined);
		const { rerender } = render(<SystemAppearanceTransition />);
		expect(getClientAppearance()).toBe("dark");

		resolvedAppearance = "light";
		rerender(<SystemAppearanceTransition />);
		expect(getClientAppearance()).toBe("light");
	});
});
