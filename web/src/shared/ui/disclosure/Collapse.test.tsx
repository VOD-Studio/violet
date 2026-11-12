import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Collapse } from "./Collapse";

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

const field = (open: boolean, keepMounted = false) => (
	<Collapse open={open} keepMounted={keepMounted}>
		<input aria-label="回复内容" />
	</Collapse>
);
const host = () => screen.getByLabelText("回复内容").parentElement?.parentElement?.parentElement;

describe("Collapse", () => {
	it("收起时内容先停用并走完过渡，之后才卸载；再展开时重新挂载", () => {
		vi.useFakeTimers();
		const { rerender } = render(field(true));
		expect(host()?.dataset.open).toBe("true");

		rerender(field(false));
		expect(host()?.dataset.open).toBe("false");
		expect(host()?.hasAttribute("inert")).toBe(true);
		expect(screen.queryByLabelText("回复内容")).not.toBeNull();

		act(() => vi.advanceTimersByTime(200));
		expect(screen.queryByLabelText("回复内容")).toBeNull();

		rerender(field(true));
		expect(screen.queryByLabelText("回复内容")).not.toBeNull();
	});

	it("收起过渡中重新展开，内容不被卸载", () => {
		vi.useFakeTimers();
		const { rerender } = render(field(true));
		rerender(field(false));
		act(() => vi.advanceTimersByTime(60));
		rerender(field(true));
		act(() => vi.advanceTimersByTime(300));
		expect(host()?.dataset.open).toBe("true");
		expect(host()?.hasAttribute("inert")).toBe(false);
	});

	it("keepMounted 收起后仍保留内容，草稿不丢", () => {
		vi.useFakeTimers();
		const { rerender } = render(field(true, true));
		(screen.getByLabelText("回复内容") as HTMLInputElement).value = "没写完的话";
		rerender(field(false, true));
		act(() => vi.advanceTimersByTime(300));
		expect((screen.getByLabelText("回复内容") as HTMLInputElement).value).toBe("没写完的话");
		expect(host()?.hasAttribute("inert")).toBe(true);
	});

	it("一开始就展开不播入场，从收起状态展开才播", () => {
		const opened = render(field(true));
		expect(host()?.hasAttribute("data-animate-in")).toBe(false);
		opened.unmount();

		const closed = render(field(false, true));
		closed.rerender(field(true, true));
		expect(host()?.hasAttribute("data-animate-in")).toBe(true);
	});
});
