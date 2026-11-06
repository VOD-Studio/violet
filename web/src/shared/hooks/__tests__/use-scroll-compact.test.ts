import { useScrollCompact } from "@shared/hooks/use-scroll-compact";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let frames: FrameRequestCallback[] = [];

/** 把窗口滚到 y 并执行下一帧里排队的更新。 */
function scrollTo(y: number) {
	Object.defineProperty(window, "scrollY", { value: y, configurable: true });
	window.dispatchEvent(new Event("scroll"));
	act(() => {
		const pending = frames;
		frames = [];
		for (const callback of pending) callback(0);
	});
}

describe("useScrollCompact", () => {
	beforeEach(() => {
		frames = [];
		Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			frames.push(callback);
			return frames.length;
		});
		vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
	});
	afterEach(() => vi.restoreAllMocks());

	it("页面顶部是展开态", () => {
		const { result } = renderHook(() => useScrollCompact());
		expect(result.current[0]).toBe(false);
	});

	it("向下滚过阈值后收起，向上滚恢复", () => {
		const { result } = renderHook(() => useScrollCompact());
		scrollTo(200);
		expect(result.current[0]).toBe(true);
		scrollTo(150);
		expect(result.current[0]).toBe(false);
	});

	it("回到顶部附近一定展开，即使仍在向下滚", () => {
		const { result } = renderHook(() => useScrollCompact());
		scrollTo(300);
		expect(result.current[0]).toBe(true);
		scrollTo(60);
		expect(result.current[0]).toBe(false);
	});

	it("阈值以内的向下滚动不收起", () => {
		const { result } = renderHook(() => useScrollCompact());
		scrollTo(40);
		scrollTo(80);
		expect(result.current[0]).toBe(false);
	});

	it("抖动级别的位移不改变状态", () => {
		const { result } = renderHook(() => useScrollCompact());
		scrollTo(300);
		scrollTo(297);
		expect(result.current[0]).toBe(true);
	});

	it("调用方可手动展开收起态", () => {
		const { result } = renderHook(() => useScrollCompact());
		scrollTo(300);
		act(() => result.current[1](false));
		expect(result.current[0]).toBe(false);
	});

	it("卸载后不再响应滚动", () => {
		const { result, unmount } = renderHook(() => useScrollCompact());
		unmount();
		scrollTo(300);
		expect(result.current[0]).toBe(false);
	});
});
