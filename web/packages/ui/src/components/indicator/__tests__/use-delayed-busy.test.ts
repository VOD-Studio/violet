import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELAY_SHOW_MS, MIN_VISIBLE_MS, useDelayedBusy } from "../use-delayed-busy";

describe("useDelayedBusy", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("短于 200ms 的等待不显示指示器", () => {
		const { result, rerender } = renderHook(({ busy }) => useDelayedBusy(busy), {
			initialProps: { busy: false },
		});
		rerender({ busy: true });
		expect(result.current).toBe(false);
		act(() => {
			vi.advanceTimersByTime(DELAY_SHOW_MS - 1);
		});
		expect(result.current).toBe(false);
		rerender({ busy: false });
		act(() => {
			vi.advanceTimersByTime(MIN_VISIBLE_MS + 10);
		});
		expect(result.current).toBe(false);
	});

	it("等待超过 200ms 后显示", () => {
		const { result, rerender } = renderHook(({ busy }) => useDelayedBusy(busy), {
			initialProps: { busy: false },
		});
		rerender({ busy: true });
		act(() => {
			vi.advanceTimersByTime(DELAY_SHOW_MS);
		});
		expect(result.current).toBe(true);
	});

	it("显示后至少停留 400ms，即使忙碌提前结束", () => {
		const { result, rerender } = renderHook(({ busy }) => useDelayedBusy(busy), {
			initialProps: { busy: false },
		});
		rerender({ busy: true });
		act(() => {
			vi.advanceTimersByTime(DELAY_SHOW_MS);
		});
		expect(result.current).toBe(true);
		// 忙碌在显示后立即结束
		rerender({ busy: false });
		act(() => {
			vi.advanceTimersByTime(MIN_VISIBLE_MS - 1);
		});
		expect(result.current, "400ms 内仍显示").toBe(true);
		act(() => {
			vi.advanceTimersByTime(1);
		});
		expect(result.current, "满 400ms 后收起").toBe(false);
	});
});
