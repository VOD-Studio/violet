import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Epigraph } from "./Epigraph";

vi.mock("motion/react", () => ({
	useReducedMotion: () => false,
}));

describe("Epigraph", () => {
	beforeEach(() => {
		Object.defineProperty(SVGElement.prototype, "getTotalLength", {
			writable: true,
			configurable: true,
			value: vi.fn().mockReturnValue(120),
		});
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("正确渲染原文引语与中文译文", () => {
		render(
			<Epigraph
				quote="We can only see a short distance ahead."
				translation="「我们只能看清眼前的一小段路。」"
			/>,
		);
		expect(screen.getByText("“We can only see a short distance ahead.”")).toBeDefined();
		expect(screen.getByText("「我们只能看清眼前的一小段路。」")).toBeDefined();
	});

	it("传入 author 时挂载作者手写签名组件", () => {
		const { container } = render(
			<Epigraph quote="Test Quote" author="Alan Turing" signature />,
		);
		const sigEl = screen.getByLabelText("作者手写签名：Alan Turing");
		expect(sigEl).toBeDefined();
		expect(container.querySelector("svg")).not.toBeNull();
	});

	it("关闭签名时降级为纯文本署名", () => {
		render(<Epigraph quote="Test Quote" author="Alan Turing" signature={false} />);
		expect(screen.getByText("Alan Turing")).toBeDefined();
		expect(screen.queryByLabelText("作者手写签名：Alan Turing")).toBeNull();
	});

	it("支持变体样式切换", () => {
		const { container } = render(<Epigraph quote="Test Quote" variant="card" />);
		expect(container.firstElementChild?.className).toContain("card");
	});
});
