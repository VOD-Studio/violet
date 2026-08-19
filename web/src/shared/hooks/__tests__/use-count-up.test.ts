import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCountUp } from "../use-count-up";

describe("useCountUp", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("首屏挂载时初始为 0 并在动画完成后达到目标值", () => {
		let now = 0;
		vi.spyOn(performance, "now").mockImplementation(() => now);
		const rafCallbacks: FrameRequestCallback[] = [];
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
			rafCallbacks.push(cb);
			return rafCallbacks.length;
		});

		const { result } = renderHook(() => useCountUp(100, 500));
		expect(result.current).toBe(0);

		// 推进一半时间
		now = 250;
		act(() => {
			const cb = rafCallbacks.shift();
			cb?.(now);
		});
		expect(result.current).toBeGreaterThan(0);
		expect(result.current).toBeLessThan(100);

		// 推进到完成
		now = 500;
		act(() => {
			const cb = rafCallbacks.shift();
			cb?.(now);
		});
		expect(result.current).toBe(100);
	});

	it("目标值为 0 时直接返回 0", () => {
		const { result } = renderHook(() => useCountUp(0, 500));
		expect(result.current).toBe(0);
	});
});
