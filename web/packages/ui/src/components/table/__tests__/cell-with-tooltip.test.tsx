import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "../../tooltip";
import { CellWithTooltip } from "../cell-with-tooltip";

const metrics = (element: HTMLElement, scrollWidth: number, clientWidth: number) => {
	Object.defineProperty(element, "scrollWidth", { configurable: true, value: scrollWidth });
	Object.defineProperty(element, "clientWidth", { configurable: true, value: clientWidth });
};
const hover = (element: Element) => {
	fireEvent.pointerMove(element, { pointerType: "mouse" });
	act(() => vi.advanceTimersByTime(0));
};

describe("CellWithTooltip", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		cleanup();
		vi.useRealTimers();
	});

	it("文本开启 ellipsis 时包进单行截断元素", () => {
		const { container } = render(
			<TooltipProvider>
				<CellWithTooltip ellipsis>Very long text content</CellWithTooltip>
			</TooltipProvider>,
		);

		const target = container.querySelector(".v-table__truncate");
		expect(target?.textContent).toBe("Very long text content");
	});

	it("单一元素开启 ellipsis 时保留元素本身并追加截断类", () => {
		render(
			<TooltipProvider>
				<CellWithTooltip ellipsis>
					<button type="button">Long title</button>
				</CellWithTooltip>
			</TooltipProvider>,
		);

		expect(screen.getByRole("button", { name: "Long title" }).classList).toContain(
			"v-table__truncate",
		);
	});

	it("没有 ellipsis 也没有 tooltip 时原样输出", () => {
		const { container } = render(<CellWithTooltip>Plain text</CellWithTooltip>);

		expect(container.querySelector(".v-table__truncate")).toBeNull();
		expect(container.textContent).toBe("Plain text");
	});

	it("截断时悬停出现完整内容", () => {
		render(
			<TooltipProvider>
				<CellWithTooltip ellipsis>一个很长的标题</CellWithTooltip>
			</TooltipProvider>,
		);
		const target = screen.getByText("一个很长的标题");
		metrics(target, 300, 100);

		hover(target);

		expect(screen.getByRole("tooltip").textContent).toBe("一个很长的标题");
	});

	it("没有截断时悬停不出现", () => {
		render(
			<TooltipProvider>
				<CellWithTooltip ellipsis>一个很长的标题</CellWithTooltip>
			</TooltipProvider>,
		);
		const target = screen.getByText("一个很长的标题");
		metrics(target, 100, 100);

		hover(target);

		expect(screen.queryByRole("tooltip")).toBeNull();
	});

	it("显式 tooltip 不看是否截断，始终显示", () => {
		render(
			<TooltipProvider>
				<CellWithTooltip ellipsis tooltip="完整说明">
					短
				</CellWithTooltip>
			</TooltipProvider>,
		);
		const target = screen.getByText("短");
		metrics(target, 10, 100);

		hover(target);

		expect(screen.getByRole("tooltip").textContent).toBe("完整说明");
	});
});
