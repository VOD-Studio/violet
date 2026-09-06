import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Signature } from "./Signature";

vi.mock("motion/react", () => ({
	useReducedMotion: () => false,
}));

describe("Signature", () => {
	beforeEach(() => {
		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
			width: 120,
			height: 36,
			top: 0,
			left: 0,
			right: 120,
			bottom: 36,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect);
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("正确渲染默认名字 xunrua 并附带无障碍标记", () => {
		render(<Signature />);
		const el = screen.getByLabelText("作者手写签名：xunrua");
		expect(el).toBeDefined();
		expect(el.textContent).toContain("xunrua");
	});

	it("支持传入任意自定义名字全动态呈现", () => {
		const { rerender } = render(<Signature name="Violet" />);
		expect(screen.getByLabelText("作者手写签名：Violet")).toBeDefined();

		rerender(<Signature name="Arthur" />);
		expect(screen.getByLabelText("作者手写签名：Arthur")).toBeDefined();
	});

	it("测宽完成后挂载动态甩尾 SVG 路径", () => {
		const { container } = render(<Signature name="xunrua" />);
		const svg = container.querySelector("svg");
		expect(svg).not.toBeNull();
		const path = svg?.querySelector("path");
		expect(path).not.toBeNull();
		expect(path?.getAttribute("d")).toContain("M");
	});

	it("支持尺寸档位与颜色变体切换", () => {
		const { container } = render(<Signature name="Violet" size="lg" variant="primary" />);
		const root = container.firstElementChild;
		expect(root?.className).toContain("sizeLg");
		expect(root?.className).toContain("variantPrimary");
	});
});
