import { useRoutingProgress } from "@shared/hooks/use-routing-progress";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

function setup(loading = false) {
	return renderHook(({ active }) => useRoutingProgress(active), {
		initialProps: { active: loading },
	});
}

describe("useRoutingProgress", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("空闲时没有进度", () => {
		const { result } = setup();
		expect(result.current).toBeNull();
	});

	it("加载满 300ms 才出现，之前不闪", () => {
		const { result, rerender } = setup();
		rerender({ active: true });
		advance(299);
		expect(result.current).toBeNull();
		advance(1);
		expect(result.current).toBeGreaterThan(0);
		expect(result.current).toBeLessThan(100);
	});

	it("300ms 内结束的加载不出现进度线", () => {
		const { result, rerender } = setup();
		rerender({ active: true });
		advance(200);
		rerender({ active: false });
		advance(1000);
		expect(result.current).toBeNull();
	});

	it("加载期间持续推进但停在 90% 以内", () => {
		const { result, rerender } = setup();
		rerender({ active: true });
		advance(300);
		const first = result.current as number;
		advance(1000);
		const later = result.current as number;
		expect(later).toBeGreaterThan(first);
		advance(60_000);
		expect(result.current).toBeLessThanOrEqual(90);
	});

	it("加载结束后先补满，再收起", () => {
		const { result, rerender } = setup();
		rerender({ active: true });
		advance(500);
		rerender({ active: false });
		expect(result.current).toBe(100);
		advance(1000);
		expect(result.current).toBeNull();
	});

	it("补满期间又开始新的加载，进度线不消失", () => {
		const { result, rerender } = setup();
		rerender({ active: true });
		advance(500);
		rerender({ active: false });
		advance(50);
		rerender({ active: true });
		advance(2000);
		expect(result.current).not.toBeNull();
		expect(result.current).toBeLessThanOrEqual(90);
	});
});
