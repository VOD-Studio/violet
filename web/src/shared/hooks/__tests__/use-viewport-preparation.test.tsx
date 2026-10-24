import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useViewportPreparation } from "../use-viewport-preparation";

let notify: IntersectionObserverCallback;
let instance: IntersectionObserver;

function PreparedBlock() {
	const { ref, ready } = useViewportPreparation<HTMLDivElement>();
	return <div ref={ref}>{ready ? "增强已准备" : "原始正文"}</div>;
}

beforeEach(() => {
	vi.stubGlobal(
		"IntersectionObserver",
		class {
			constructor(callback: IntersectionObserverCallback) {
				notify = callback;
				instance = this as unknown as IntersectionObserver;
			}
			observe() {}
			unobserve() {}
			disconnect() {}
		},
	);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

function intersect(target: Element, isIntersecting: boolean) {
	act(() => notify([{ target, isIntersecting } as IntersectionObserverEntry], instance));
}

describe("useViewportPreparation", () => {
	it("SSR 直接输出原始正文，不提前启用增强", () => {
		expect(renderToString(<PreparedBlock />)).toContain("原始正文");
	});

	it("远处保持正文，接近一次后滚出仍保留增强结果", () => {
		render(<PreparedBlock />);
		const host = screen.getByText("原始正文");
		intersect(host, false);
		expect(host.textContent).toBe("原始正文");
		intersect(host, true);
		expect(host.textContent).toBe("增强已准备");
		intersect(host, false);
		expect(host.textContent).toBe("增强已准备");
	});

	it("一个块接近不会激活仍在远处的块", () => {
		render(
			<>
				<PreparedBlock />
				<PreparedBlock />
			</>,
		);
		const hosts = screen.getAllByText("原始正文");
		intersect(hosts[1], true);
		expect(hosts[0].textContent).toBe("原始正文");
		expect(hosts[1].textContent).toBe("增强已准备");
	});

	it("不支持 IntersectionObserver 时仍能完成增强", () => {
		vi.stubGlobal("IntersectionObserver", undefined);
		render(<PreparedBlock />);
		expect(screen.getByText("增强已准备")).toBeTruthy();
	});
});
