import { vi } from "vitest";

// jsdom 不提供布局观察器；实际溢出测量由正文用例和真实浏览器验证。
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
