import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnnotationReveal } from "../AnnotationReveal";

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe("AnnotationReveal", () => {
	it("收起时内容先停用并走完过渡，之后才卸载；再展开时重新挂载", () => {
		vi.useFakeTimers();
		const { rerender } = render(
			<AnnotationReveal open>
				<input aria-label="回复内容" />
			</AnnotationReveal>,
		);
		const input = screen.getByLabelText("回复内容");
		const host = input.closest(".annotation-reveal") as HTMLElement;
		expect(host.dataset.state).toBe("open");

		rerender(
			<AnnotationReveal open={false}>
				<input aria-label="回复内容" />
			</AnnotationReveal>,
		);
		expect(host.dataset.state).toBe("closed");
		expect(host.hasAttribute("inert")).toBe(true);
		expect(screen.queryByLabelText("回复内容")).not.toBeNull();

		act(() => vi.advanceTimersByTime(200));
		expect(screen.queryByLabelText("回复内容")).toBeNull();

		rerender(
			<AnnotationReveal open>
				<input aria-label="回复内容" />
			</AnnotationReveal>,
		);
		expect(screen.queryByLabelText("回复内容")).not.toBeNull();
	});

	it("收起过渡中重新展开，内容不被卸载", () => {
		vi.useFakeTimers();
		const view = (open: boolean) => (
			<AnnotationReveal open={open}>
				<input aria-label="回复内容" />
			</AnnotationReveal>
		);
		const { rerender } = render(view(true));
		rerender(view(false));
		act(() => vi.advanceTimersByTime(60));
		rerender(view(true));
		act(() => vi.advanceTimersByTime(300));
		const host = screen.getByLabelText("回复内容").closest(".annotation-reveal") as HTMLElement;
		expect(host.dataset.state).toBe("open");
		expect(host.hasAttribute("inert")).toBe(false);
	});
});
