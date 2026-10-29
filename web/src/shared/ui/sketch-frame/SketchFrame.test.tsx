import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SketchFrame } from "./SketchFrame";

let intersect: IntersectionObserverCallback;
let resize: ResizeObserverCallback;
let observer: IntersectionObserver;
let sizeObserver: ResizeObserver;
let width = 320;

beforeEach(() => {
	vi.useFakeTimers();
	width = 320;
	vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
		() => new DOMRect(0, 0, width, 120),
	);
	vi.stubGlobal(
		"IntersectionObserver",
		class {
			constructor(callback: IntersectionObserverCallback) {
				intersect = callback;
				observer = this as unknown as IntersectionObserver;
			}
			observe() {}
			unobserve() {}
			disconnect() {}
		},
	);
	vi.stubGlobal(
		"ResizeObserver",
		class {
			constructor(callback: ResizeObserverCallback) {
				resize = callback;
				sizeObserver = this as unknown as ResizeObserver;
			}
			observe() {}
			disconnect() {}
		},
	);
});

afterEach(async () => {
	cleanup();
	await vi.runAllTimersAsync();
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("SketchFrame", () => {
	it("远处仅显示内容；准备后同尺寸与换色保留 SVG，尺寸变化才更新外框", async () => {
		const { container, rerender } = render(
			<SketchFrame>
				<p>表格正文始终可读</p>
			</SketchFrame>,
		);
		const host = container.firstElementChild;
		expect(host?.textContent).toContain("表格正文始终可读");
		expect(container.querySelector("svg")).toBeNull();
		act(() =>
			intersect(
				[{ target: host, isIntersecting: true } as IntersectionObserverEntry],
				observer,
			),
		);
		await act(() => vi.dynamicImportSettled());
		await act(() => vi.runAllTimersAsync());
		const original = container.querySelector("svg");
		expect(original).toBeTruthy();
		const originalMarkup = original?.outerHTML;

		act(() => resize([], sizeObserver));
		await act(() => vi.runAllTimersAsync());
		expect(container.querySelector("svg")).toBe(original);
		rerender(
			<SketchFrame frameClassName="text-primary/80">
				<p>表格正文始终可读</p>
			</SketchFrame>,
		);
		await act(() => vi.runAllTimersAsync());
		expect(container.querySelector("svg")).toBe(original);
		act(() =>
			intersect(
				[{ target: host, isIntersecting: false } as IntersectionObserverEntry],
				observer,
			),
		);
		expect(container.querySelector("svg")).toBe(original);

		width = 480;
		act(() => resize([], sizeObserver));
		await act(() => vi.runAllTimersAsync());
		expect(container.querySelector("svg")).not.toBe(original);
		expect(container.querySelector("svg")?.outerHTML).not.toBe(originalMarkup);
		expect(host?.textContent).toContain("表格正文始终可读");
	});
});
