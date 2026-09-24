import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CartoonPopoverGroup, CartoonPopoverGroupItem } from "../CartoonPopoverGroup";

describe("CartoonPopoverGroup Component", () => {
	afterEach(() => {
		cleanup();
		vi.useRealTimers();
	});

	it("在群组中悬停条目时弹出共享浮层，滑向下一个条目时平滑切换而不卸载", () => {
		vi.useFakeTimers();
		render(
			<CartoonPopoverGroup closeDelay={150}>
				<CartoonPopoverGroupItem
					value="tab1"
					trigger={<button type="button">按钮一</button>}
					title="标题一"
				>
					<p>内容一</p>
				</CartoonPopoverGroupItem>
				<CartoonPopoverGroupItem
					value="tab2"
					trigger={<button type="button">按钮二</button>}
					title="标题二"
				>
					<p>内容二（高度更高）</p>
				</CartoonPopoverGroupItem>
			</CartoonPopoverGroup>,
		);

		expect(screen.queryByRole("dialog")).toBeNull();

		// 鼠标滑入第一个按钮
		const btn1 = screen.getByText("按钮一");
		const trigger1 = btn1.closest("[data-popover-item]");
		if (!trigger1) throw new Error("Trigger 1 not found");
		fireEvent.mouseEnter(trigger1);
		act(() => {
			vi.advanceTimersByTime(20);
		});

		// 浮层已打开，展示内容一
		const dialog1 = screen.getByRole("dialog");
		expect(within(dialog1).getByText("内容一")).toBeTruthy();

		// 鼠标直接滑入第二个按钮（不收起，直接切换）
		const btn2 = screen.getByText("按钮二");
		const trigger2 = btn2.closest("[data-popover-item]");
		if (!trigger2) throw new Error("Trigger 2 not found");
		fireEvent.mouseEnter(trigger2);
		act(() => {
			vi.advanceTimersByTime(20);
		});

		// 浮层始终保持，内容无缝平滑切至内容二
		const dialog2 = screen.getByRole("dialog");
		expect(within(dialog2).getByText("内容二（高度更高）")).toBeTruthy();

		// 鼠标移出第二个按钮并超时
		fireEvent.mouseLeave(trigger2);
		act(() => {
			vi.advanceTimersByTime(160);
		});
		// 弹簧自然衰减至停机（precision=0.01 约需 1s）
		act(() => {
			vi.advanceTimersByTime(1200);
		});
		expect(screen.queryByRole("dialog")).toBeNull();
	});
});
