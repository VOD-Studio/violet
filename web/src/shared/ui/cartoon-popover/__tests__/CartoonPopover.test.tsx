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
import { ScalarSpringStore } from "../spring-store";

describe("CartoonPopover Component", () => {
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("弹簧在掉帧后保持气泡进度有界，瞬移可中断关闭", () => {
		const frames: FrameRequestCallback[] = [];
		vi.stubGlobal(
			"requestAnimationFrame",
			vi.fn((callback: FrameRequestCallback) => {
				frames.push(callback);
				return frames.length;
			}),
		);
		vi.stubGlobal("cancelAnimationFrame", vi.fn());
		vi.spyOn(performance, "now").mockReturnValue(0);
		const spring = new ScalarSpringStore(0, {
			stiffness: 360,
			damping: 38,
			mass: 0.8,
		});

		spring.setTarget(1);
		frames.shift()?.(64);
		expect(spring.getSnapshot()).toBeGreaterThan(0);
		expect(spring.getSnapshot()).toBeLessThanOrEqual(1);

		spring.snapTo(0);
		expect(spring.getSnapshot()).toBe(0);
		expect(cancelAnimationFrame).toHaveBeenCalled();
	});

	it("减少动效时立即开合，不留下可聚焦的退出气泡", () => {
		vi.stubGlobal(
			"matchMedia",
			vi.fn(() => ({
				matches: true,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			})),
		);
		render(
			<CartoonPopover>
				<CartoonPopoverTrigger>减少动效触发器</CartoonPopoverTrigger>
				<CartoonPopoverContent variant="dark" showClose>
					减少动效内容
				</CartoonPopoverContent>
			</CartoonPopover>,
		);
		fireEvent.click(screen.getByRole("button", { name: "减少动效触发器" }));
		expect(screen.getByRole("dialog").style.opacity).toBe("1");
		expect(screen.getByText("减少动效内容").style.opacity).toBe("");
		fireEvent.click(screen.getByRole("button", { name: "关闭" }));
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("关闭途中重新打开时复用同一气泡并反向收笔", () => {
		vi.useFakeTimers();
		render(
			<CartoonPopover>
				<CartoonPopoverTrigger>反向触发器</CartoonPopoverTrigger>
				<CartoonPopoverContent>可逆动画</CartoonPopoverContent>
			</CartoonPopover>,
		);
		const trigger = screen.getByRole("button", { name: "反向触发器" });
		fireEvent.click(trigger);
		act(() => vi.advanceTimersByTime(240));
		const bubble = screen.getByRole("dialog");
		act(() => vi.advanceTimersByTime(20));
		// 描线动画期间：轮廓常驻、dashoffset 描绘中，边框轨道恒为 SVG 单一来源
		const strokes = bubble.querySelectorAll("svg path[stroke-dashoffset]");
		expect(strokes).toHaveLength(2);
		expect(Number(strokes[0].getAttribute("stroke-dashoffset"))).toBeGreaterThan(0);
		expect(bubble.style.borderColor).toBe("transparent");
		fireEvent.click(trigger);
		act(() => vi.advanceTimersByTime(48));
		expect(document.querySelector('[data-slot="cartoon-popover-content"]')).toBe(bubble);
		expect(bubble.getAttribute("aria-hidden")).toBe("true");
		const closingOpacity = Number(bubble.style.opacity);
		expect(closingOpacity).toBeGreaterThan(0);
		expect(closingOpacity).toBeLessThan(1);
		fireEvent.click(trigger);
		expect(screen.getByRole("dialog")).toBe(bubble);
		expect(Number(bubble.style.opacity)).toBeCloseTo(closingOpacity, 5);
		act(() => vi.advanceTimersByTime(800));
		expect(Number(bubble.style.opacity)).toBeGreaterThan(0.99);
		// 描满后同一条轨道完整显示，无几何切换（dashoffset 归零、border 依旧透明）
		const done = bubble.querySelectorAll("svg path[stroke-dashoffset]");
		expect(Number(done[0].getAttribute("stroke-dashoffset"))).toBeCloseTo(0, 5);
		expect(bubble.style.borderColor).toBe("transparent");
		vi.useRealTimers();
	});

	it("Dark 在打开时先描线后显字，关闭时先退字", () => {
		vi.useFakeTimers();
		render(
			<CartoonPopover>
				<CartoonPopoverTrigger>夜墨触发器</CartoonPopoverTrigger>
				<CartoonPopoverContent variant="dark">夜墨正文</CartoonPopoverContent>
			</CartoonPopover>,
		);
		const trigger = screen.getByRole("button", { name: "夜墨触发器" });
		fireEvent.click(trigger);
		act(() => vi.advanceTimersByTime(160));
		const bubble = screen.getByRole("dialog");
		const body = screen.getByText("夜墨正文");
		expect(Number(body.style.opacity)).toBeLessThan(Number(bubble.style.opacity));
		act(() => vi.advanceTimersByTime(800));
		expect(Number(body.style.opacity)).toBe(1);
		fireEvent.click(trigger);
		act(() => vi.advanceTimersByTime(100));
		expect(Number(body.style.opacity)).toBeLessThan(Number(bubble.style.opacity));
		vi.useRealTimers();
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

	it("渲染色彩变体与贴纸气泡形态属性", () => {
		render(
			<CartoonPopover defaultOpen>
				<CartoonPopoverTrigger>触发器</CartoonPopoverTrigger>
				<CartoonPopoverContent variant="brand" bubbleStyle="sticker" shadowStyle="comic">
					<CartoonPopoverHeader>
						<CartoonPopoverTitle>便签标题</CartoonPopoverTitle>
						<CartoonPopoverClose />
					</CartoonPopoverHeader>
					<CartoonPopoverDescription>喵喵喵</CartoonPopoverDescription>
				</CartoonPopoverContent>
			</CartoonPopover>,
		);

		const content = screen.getByRole("dialog");
		expect(content.getAttribute("data-variant")).toBe("brand");
		expect(content.getAttribute("data-bubble-style")).toBe("sticker");
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
