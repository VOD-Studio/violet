import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MediaListener = (event: { matches: boolean }) => void;

function stubMatchMedia(initialDark: boolean): {
	setDark: (dark: boolean) => void;
} {
	let dark = initialDark;
	const listeners = new Set<MediaListener>();
	vi.stubGlobal(
		"matchMedia",
		vi.fn().mockImplementation((query: string) => ({
			get matches() {
				return dark;
			},
			media: query,
			addEventListener: (_: string, listener: MediaListener) => {
				listeners.add(listener);
			},
			removeEventListener: (_: string, listener: MediaListener) => {
				listeners.delete(listener);
			},
		})),
	);
	return {
		setDark(next: boolean) {
			dark = next;
			for (const listener of listeners) listener({ matches: next });
		},
	};
}

// 每个用例经 vi.resetModules 后需重新加载模块以获得干净的模块级主题状态，
// 静态导入无法满足，这里有意使用动态导入。
async function loadHook() {
	const mod = await import("./use-theme");
	return mod.useTheme;
}

describe("useTheme", () => {
	beforeEach(() => {
		vi.resetModules();
		localStorage.clear();
		document.documentElement.className = "";
	});

	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	it("无存储值时回退 defaultTheme", async () => {
		stubMatchMedia(false);
		const useTheme = await loadHook();
		const { result } = renderHook(() => useTheme("dark"));
		expect(result.current.theme).toBe("dark");
		expect(result.current.resolvedTheme).toBe("dark");
		expect(document.documentElement.classList.contains("dark")).toBe(true);
	});

	it("优先使用 localStorage 中的持久化选择", async () => {
		localStorage.setItem("violet-theme", "light");
		stubMatchMedia(true);
		const useTheme = await loadHook();
		const { result } = renderHook(() => useTheme("dark"));
		expect(result.current.theme).toBe("light");
		expect(result.current.resolvedTheme).toBe("light");
		expect(document.documentElement.classList.contains("dark")).toBe(false);
	});

	it("存储值非法时回退 defaultTheme", async () => {
		localStorage.setItem("violet-theme", "neon");
		stubMatchMedia(false);
		const useTheme = await loadHook();
		const { result } = renderHook(() => useTheme("light"));
		expect(result.current.theme).toBe("light");
	});

	it("setTheme 更新选择、html 类并写入 localStorage", async () => {
		stubMatchMedia(false);
		const useTheme = await loadHook();
		const { result } = renderHook(() => useTheme());
		act(() => result.current.setTheme("dark"));
		expect(result.current.theme).toBe("dark");
		expect(result.current.resolvedTheme).toBe("dark");
		expect(document.documentElement.classList.contains("dark")).toBe(true);
		expect(localStorage.getItem("violet-theme")).toBe("dark");
		act(() => result.current.setTheme("light"));
		expect(document.documentElement.classList.contains("dark")).toBe(false);
		expect(localStorage.getItem("violet-theme")).toBe("light");
	});

	it("system 按 prefers-color-scheme 解析并响应系统偏好变化", async () => {
		const media = stubMatchMedia(true);
		const useTheme = await loadHook();
		const { result } = renderHook(() => useTheme());
		expect(result.current.theme).toBe("system");
		expect(result.current.resolvedTheme).toBe("dark");
		expect(document.documentElement.classList.contains("dark")).toBe(true);
		act(() => media.setDark(false));
		expect(result.current.resolvedTheme).toBe("light");
		expect(document.documentElement.classList.contains("dark")).toBe(false);
	});

	it("显式选择 light 时不响应系统偏好变化", async () => {
		const media = stubMatchMedia(true);
		const useTheme = await loadHook();
		const { result } = renderHook(() => useTheme());
		act(() => result.current.setTheme("light"));
		expect(document.documentElement.classList.contains("dark")).toBe(false);
		act(() => media.setDark(true));
		expect(result.current.theme).toBe("light");
		expect(document.documentElement.classList.contains("dark")).toBe(false);
	});

	it("同页多实例共享同一状态", async () => {
		stubMatchMedia(false);
		const useTheme = await loadHook();
		const first = renderHook(() => useTheme());
		const second = renderHook(() => useTheme());
		act(() => first.result.current.setTheme("dark"));
		expect(second.result.current.theme).toBe("dark");
	});
});
