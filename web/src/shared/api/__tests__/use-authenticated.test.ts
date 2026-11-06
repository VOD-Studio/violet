import { clearSessionActive, markSessionActive, useSessionStore } from "@shared/api/session";
import { useAuthenticated } from "@shared/api/use-authenticated";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

describe("useAuthenticated", () => {
	beforeEach(() => {
		useSessionStore.setState({ sessionActive: false, sessionVersion: 0 });
	});

	it("首渲染取 SSR 登录态：SSR 已登录时即使会话标记还没写入也是已登录", () => {
		expect(renderHook(() => useAuthenticated(true)).result.current).toBe(true);
		expect(renderHook(() => useAuthenticated(false)).result.current).toBe(false);
	});

	it("登录成功后立即视为已登录，不必等路由上下文刷新", () => {
		const { result } = renderHook(() => useAuthenticated(false));
		act(() => markSessionActive());
		expect(result.current).toBe(true);
	});

	it("SSR 已登录的页面上登出，立即视为未登录", () => {
		const { result } = renderHook(() => useAuthenticated(true));
		act(() => markSessionActive());
		expect(result.current).toBe(true);
		act(() => clearSessionActive());
		expect(result.current).toBe(false);
	});

	it("登出后再登录恢复为已登录", () => {
		const { result } = renderHook(() => useAuthenticated(true));
		act(() => markSessionActive());
		act(() => clearSessionActive());
		act(() => markSessionActive());
		expect(result.current).toBe(true);
	});
});
