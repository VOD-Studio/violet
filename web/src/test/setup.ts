import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/**
 * vitest 未开 globals 时 RTL 不会自动卸载组件，跨用例残留的 mounted 树会
 * 干扰 getAllByRole 等全局查询（拿到上一个用例的旧实例）。统一在用例后卸载。
 */
afterEach(() => {
	cleanup();
});

/**
 * jsdom 未实现 ResizeObserver，而 Radix UI 的 Popper/Tooltip 等组件
 * 在布局副作用中会用到。提供一个最小 mock 避免测试抛未处理异常。
 */
class ResizeObserverMock {
	observe = vi.fn();
	unobserve = vi.fn();
	disconnect = vi.fn();
}

Object.defineProperty(globalThis, "ResizeObserver", {
	writable: true,
	configurable: true,
	value: ResizeObserverMock,
});
