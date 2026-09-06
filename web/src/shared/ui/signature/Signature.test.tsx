import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Signature } from "./Signature";

vi.mock("motion/react", () => ({
	useReducedMotion: () => false,
}));

describe("Signature (真·笔顺矢量书写引擎)", () => {
	beforeEach(() => {
		// jsdom 下补齐 SVGPathElement.getTotalLength mock
		Object.defineProperty(SVGElement.prototype, "getTotalLength", {
			writable: true,
			configurable: true,
			value: vi.fn().mockReturnValue(150),
		});
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("正确渲染默认名字 xunrua 的 8 段草书笔画", () => {
		const { container } = render(<Signature />);
		const el = screen.getByLabelText("作者手写签名：xunrua");
		expect(el).toBeDefined();

		const paths = container.querySelectorAll("path[data-stroke-index]");
		expect(paths).toHaveLength(8);
	});

	it("传入 Violet 时切换为 Violet 专属花体笔画", () => {
		const { container, rerender } = render(<Signature name="Violet" />);
		const violetPaths = container.querySelectorAll("path[data-stroke-index]");
		expect(violetPaths).toHaveLength(8);
		const svg = container.querySelector("svg");
		expect(svg?.getAttribute("viewBox")).toBe("0 0 350 110");

		rerender(<Signature name="xunrua" />);
		expect(svg?.getAttribute("viewBox")).toBe("0 0 380 110");
	});

	it("支持尺寸档位与颜色变体切换", () => {
		const { container } = render(<Signature name="Violet" size="lg" variant="primary" />);
		const root = container.firstElementChild;
		expect(root?.className).toContain("sizeLg");
		expect(root?.className).toContain("variantPrimary");
	});

	it("初次挂载时将笔画重置为起点准备书写", () => {
		const { container } = render(<Signature name="xunrua" autoPlay />);
		const path = container.querySelector("path[data-stroke-index='0']") as SVGPathElement;
		expect(path).not.toBeNull();
		// 校验笔画已经绑定 strokeDasharray
		expect(path.style.strokeDasharray).toBe("150 150");
	});
});
