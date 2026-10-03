import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(cleanup);

class ObserverMock {
	observe = vi.fn();
	unobserve = vi.fn();
	disconnect = vi.fn();
}

Object.defineProperty(globalThis, "ResizeObserver", {
	value: ObserverMock,
	writable: true,
	configurable: true,
});
Object.defineProperty(globalThis, "IntersectionObserver", {
	value: ObserverMock,
	writable: true,
	configurable: true,
});
Object.defineProperty(globalThis, "matchMedia", {
	value: (query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	}),
	writable: true,
	configurable: true,
});
Object.defineProperty(Element.prototype, "scrollIntoView", {
	value: vi.fn(),
	writable: true,
	configurable: true,
});
