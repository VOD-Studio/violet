import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	CartoonPopover,
	CartoonPopoverClose,
	CartoonPopoverContent,
	CartoonPopoverDescription,
	CartoonPopoverHeader,
	CartoonPopoverTitle,
	CartoonPopoverTrigger,
} from "../CartoonPopover";

describe("CartoonPopover Component", () => {
	afterEach(() => {
		cleanup();
	});

	it("点击触发器可以展开与收起浮层，并正确设置 aria 属性", () => {
		render(
			<CartoonPopover>
				<CartoonPopoverTrigger>打开对白</CartoonPopoverTrigger>
				<CartoonPopoverContent title="气泡标题">对白正文内容</CartoonPopoverContent>
			</CartoonPopover>,
		);

		const trigger = screen.getByRole("button", { name: "打开对白" });
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
		expect(screen.queryByText("对白正文内容")).toBeNull();

		// 点击打开
		fireEvent.click(trigger);
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
		expect(screen.getByText("对白正文内容")).toBeTruthy();
		expect(screen.getByText("气泡标题")).toBeTruthy();

		// 再次点击关闭
		fireEvent.click(trigger);
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
	});

	it("支持 asChild 模式并将事件绑定到子元素", () => {
		render(
			<CartoonPopover>
				<CartoonPopoverTrigger asChild>
					<button type="button" className="custom-trigger">
						自定义触发器
					</button>
				</CartoonPopoverTrigger>
				<CartoonPopoverContent>气泡内容</CartoonPopoverContent>
			</CartoonPopover>,
		);

		const trigger = screen.getByText("自定义触发器");
		expect(trigger.className).toContain("custom-trigger");
		expect(trigger.getAttribute("aria-expanded")).toBe("false");

		fireEvent.click(trigger);
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
		expect(screen.getByText("气泡内容")).toBeTruthy();
	});

	it("按下 Escape 键时关闭浮层", () => {
		render(
			<CartoonPopover defaultOpen>
				<CartoonPopoverTrigger>触发器</CartoonPopoverTrigger>
				<CartoonPopoverContent>Esc测试内容</CartoonPopoverContent>
			</CartoonPopover>,
		);

		expect(screen.getByText("Esc测试内容")).toBeTruthy();

		fireEvent.keyDown(document, { key: "Escape" });
		const trigger = screen.getByRole("button", { name: "触发器" });
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
	});

	it("点击外部区域时关闭浮层", () => {
		render(
			<div>
				<button type="button">外部按钮</button>
				<CartoonPopover defaultOpen>
					<CartoonPopoverTrigger>触发器</CartoonPopoverTrigger>
					<CartoonPopoverContent>外部点击内容</CartoonPopoverContent>
				</CartoonPopover>
			</div>,
		);

		expect(screen.getByText("外部点击内容")).toBeTruthy();

		fireEvent.mouseDown(screen.getByRole("button", { name: "外部按钮" }));
		const trigger = screen.getByRole("button", { name: "触发器" });
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
	});

	it("支持受控模式的 open 与 onOpenChange", () => {
		const onOpenChange = vi.fn();
		const { rerender } = render(
			<CartoonPopover open={false} onOpenChange={onOpenChange}>
				<CartoonPopoverTrigger>受控触发器</CartoonPopoverTrigger>
				<CartoonPopoverContent>受控内容</CartoonPopoverContent>
			</CartoonPopover>,
		);

		const trigger = screen.getByRole("button", { name: "受控触发器" });
		fireEvent.click(trigger);
		expect(onOpenChange).toHaveBeenCalledWith(true);

		rerender(
			<CartoonPopover open={true} onOpenChange={onOpenChange}>
				<CartoonPopoverTrigger>受控触发器</CartoonPopoverTrigger>
				<CartoonPopoverContent>受控内容</CartoonPopoverContent>
			</CartoonPopover>,
		);

		expect(screen.getByText("受控内容")).toBeTruthy();
	});

	it("渲染色彩变体与思考气泡形态属性", () => {
		render(
			<CartoonPopover defaultOpen>
				<CartoonPopoverTrigger>触发器</CartoonPopoverTrigger>
				<CartoonPopoverContent variant="brand" bubbleStyle="thought" shadowStyle="comic">
					<CartoonPopoverHeader>
						<CartoonPopoverTitle>思考中</CartoonPopoverTitle>
						<CartoonPopoverClose />
					</CartoonPopoverHeader>
					<CartoonPopoverDescription>喵喵喵</CartoonPopoverDescription>
				</CartoonPopoverContent>
			</CartoonPopover>,
		);

		const content = screen.getByRole("dialog");
		expect(content.getAttribute("data-variant")).toBe("brand");
		expect(content.getAttribute("data-bubble-style")).toBe("thought");
		expect(content.className).toContain("shadow-[3px_3px_0_0_var(--cartoon-shadow)]");

		// 点击右上角关闭胶囊
		const closeBtn = screen.getByRole("button", { name: "关闭" });
		fireEvent.click(closeBtn);
		const trigger = screen.getByRole("button", { name: "触发器" });
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
	});

	it("快捷属性 showClose 自动生成关闭按钮", () => {
		render(
			<CartoonPopover defaultOpen>
				<CartoonPopoverTrigger>触发器</CartoonPopoverTrigger>
				<CartoonPopoverContent title="快捷标题" showClose>
					快捷内容
				</CartoonPopoverContent>
			</CartoonPopover>,
		);

		const closeBtn = screen.getByRole("button", { name: "关闭" });
		fireEvent.click(closeBtn);
		const trigger = screen.getByRole("button", { name: "触发器" });
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
	});

	it("支持 hover 悬停触发与移入内容区保持打开", () => {
		vi.useFakeTimers();
		render(
			<CartoonPopover triggerMode="hover" hoverDelay={50} closeDelay={100}>
				<CartoonPopoverTrigger>悬停触发器</CartoonPopoverTrigger>
				<CartoonPopoverContent>悬停内容</CartoonPopoverContent>
			</CartoonPopover>,
		);

		const trigger = screen.getByRole("button", { name: "悬停触发器" });
		expect(trigger.getAttribute("aria-expanded")).toBe("false");

		// 鼠标悬停进入
		fireEvent.mouseEnter(trigger);
		act(() => {
			vi.advanceTimersByTime(50);
		});
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
		expect(screen.getByText("悬停内容")).toBeTruthy();

		// 离开触发器，但在 closeDelay 内进入气泡内容区
		fireEvent.mouseLeave(trigger);
		const content = screen.getByRole("dialog");
		fireEvent.mouseEnter(content);
		act(() => {
			vi.advanceTimersByTime(120);
		});
		// 仍在气泡内，保持打开
		expect(trigger.getAttribute("aria-expanded")).toBe("true");

		// 离开气泡内容区，超时关闭
		fireEvent.mouseLeave(content);
		act(() => {
			vi.advanceTimersByTime(100);
		});
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
		vi.useRealTimers();
	});
});
