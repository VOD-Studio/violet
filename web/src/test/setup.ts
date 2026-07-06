import { vi } from "vitest";

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
