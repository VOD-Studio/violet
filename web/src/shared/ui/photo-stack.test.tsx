import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PhotoStack, type PhotoStackImage } from "./photo-stack";

const images: PhotoStackImage[] = [
	{ src: "/one.jpg", alt: "第一张" },
	{ src: "/two.jpg", alt: "第二张" },
	{ src: "/three.jpg", alt: "第三张" },
	{ src: "/four.jpg", alt: "第四张" },
];

afterEach(() => {
	vi.useRealTimers();
});

function stackProps(onImageOpen = vi.fn()) {
	return { images, onImageOpen, footer: <span>图集</span> };
}

describe("PhotoStack", () => {
	it("首张、中间、末张使用不同真实槽位状态", () => {
		vi.useFakeTimers();
		const { rerender } = render(<PhotoStack {...stackProps()} />);
		const stack = screen.getByRole("group");
		expect(stack.getAttribute("data-stack-state")).toBe("first");
		expect(stack.querySelectorAll('[data-card-state="right"]').length).toBe(3);
		expect(stack.querySelectorAll('[data-card-state="left"]').length).toBe(0);

		fireEvent.pointerDown(stack, { button: 0, clientX: 200, pointerId: 1 });
		fireEvent.pointerMove(stack, { clientX: -30, pointerId: 1 });
		fireEvent.pointerUp(stack, { clientX: -30, pointerId: 1 });
		act(() => vi.runAllTimers());
		expect(stack.getAttribute("data-stack-state")).toBe("middle");
		expect(stack.querySelectorAll('[data-card-state="left"]').length).toBe(1);
		expect(stack.querySelectorAll('[data-card-state="right"]').length).toBe(2);
		fireEvent.pointerDown(stack, { button: 0, clientX: 100, pointerId: 9 });
		fireEvent.pointerMove(stack, { clientX: 180, pointerId: 9 });
		expect(stack.getAttribute("data-drag-direction")).toBe("left");
		const incomingPrevious = stack.querySelector(
			'[data-card-state="left"][data-card-depth="1"]',
		);
		const idleNext = stack.querySelector('[data-card-state="right"][data-card-depth="1"]');
		expect(Number(incomingPrevious?.getAttribute("data-card-z"))).toBeGreaterThan(
			Number(idleNext?.getAttribute("data-card-z")),
		);
		fireEvent.pointerCancel(stack, { pointerId: 9 });

		fireEvent.pointerDown(stack, { button: 0, clientX: 100, pointerId: 2 });
		fireEvent.pointerMove(stack, { clientX: -140, pointerId: 2 });
		fireEvent.pointerUp(stack, { clientX: -140, pointerId: 2 });
		act(() => vi.runAllTimers());
		fireEvent.pointerDown(stack, { button: 0, clientX: 100, pointerId: 3 });
		fireEvent.pointerMove(stack, { clientX: -140, pointerId: 3 });
		fireEvent.pointerUp(stack, { clientX: -140, pointerId: 3 });
		act(() => vi.runAllTimers());
		expect(stack.getAttribute("data-stack-state")).toBe("last");
		expect(stack.querySelectorAll('[data-card-state="left"]').length).toBe(3);
		expect(stack.querySelectorAll('[data-card-state="right"]').length).toBe(0);
		rerender(<PhotoStack {...stackProps()} />);
	});

	it("首尾不循环，边界拖动回弹且未误触打开", () => {
		vi.useFakeTimers();
		const onImageOpen = vi.fn();
		render(<PhotoStack {...stackProps(onImageOpen)} />);
		const stack = screen.getByRole("group");
		fireEvent.pointerDown(stack, { button: 0, clientX: 100, pointerId: 1 });
		fireEvent.pointerMove(stack, { clientX: 190, pointerId: 1 });
		fireEvent.pointerUp(stack, { clientX: 190, pointerId: 1 });
		expect(stack.getAttribute("data-current-index")).toBe("0");
		fireEvent.click(screen.getByRole("button", { name: "第一张" }));
		expect(onImageOpen.mock.calls.length).toBe(0);
		vi.runAllTimers();

		fireEvent.keyDown(stack, { key: "ArrowLeft" });
		expect(stack.getAttribute("data-current-index")).toBe("0");
	});

	it("拖过阈值后旧卡平滑插入后置槽位并提交索引", () => {
		vi.useFakeTimers();
		const onImageOpen = vi.fn();
		render(<PhotoStack {...stackProps(onImageOpen)} />);
		const stack = screen.getByRole("group");
		const incoming = screen.getByRole("button", { name: "第二张" });
		fireEvent.pointerDown(stack, { button: 0, clientX: 200, pointerId: 1 });
		fireEvent.pointerMove(stack, { clientX: -30, pointerId: 1 });
		expect(incoming.getAttribute("data-card-state")).toBe("right");
		fireEvent.pointerUp(stack, { clientX: -30, pointerId: 1 });
		expect(stack.getAttribute("data-current-index")).toBe("0");
		act(() => vi.advanceTimersByTime(220));
		expect(stack.getAttribute("data-current-index")).toBe("1");
		expect(screen.getByRole("button", { name: "第二张" }).getAttribute("data-card-state")).toBe(
			"current",
		);

		fireEvent.click(screen.getByRole("button", { name: /展开全部照片，共 4 张/ }));
		expect(screen.getByRole("button", { name: "收起为堆叠" })).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "第三张" }));
		expect(onImageOpen.mock.calls).toEqual([[2]]);
		expect(screen.getByRole("group")).toBeTruthy();
	});

	it("两阶段拖拽：拉出至只剩 1/5 前 1:1 跟手置顶，过阈值后继续拖动平滑插回后置槽位且目标卡置顶", () => {
		vi.useFakeTimers();
		render(<PhotoStack {...stackProps()} />);
		const stack = screen.getByRole("group");
		const current = screen.getByRole("button", { name: "第一张" });
		const incoming = screen.getByRole("button", { name: "第二张" });

		fireEvent.pointerDown(stack, { button: 0, clientX: 300, pointerId: 1 });

		// 1. 中大行程拉出 (120px < 280*0.8=224px) -> 1:1 跟手，当前卡在顶层 (100)，后卡在底层 (69)
		fireEvent.pointerMove(stack, { clientX: 180, pointerId: 1 });
		expect(Number(current.getAttribute("data-card-z"))).toBe(100);
		expect(Number(incoming.getAttribute("data-card-z"))).toBe(69);
		expect(Number(stack.getAttribute("data-current-offset"))).toBe(-120);

		// 2. 超出 4/5 阈值继续向左拉 (280px > 224px) -> 目标卡置顶 (100)，当前卡钻入底层 (90) 并平滑向左槽位 (-22.4px) 插回
		fireEvent.pointerMove(stack, { clientX: 20, pointerId: 1 });
		expect(Number(current.getAttribute("data-card-z"))).toBe(90);
		expect(Number(incoming.getAttribute("data-card-z"))).toBe(100);
		expect(Number(stack.getAttribute("data-current-offset"))).toBeCloseTo(-123.2, 1);

		// 3. 充分拖动 (336px = 280*1.2) -> 完全进入左侧后置槽位 (-22.4px)
		fireEvent.pointerMove(stack, { clientX: -36, pointerId: 1 });
		expect(Number(stack.getAttribute("data-current-offset"))).toBeCloseTo(-22.4, 1);
		// 4. 松手 -> 结算为第 2 张
		fireEvent.pointerUp(stack, { clientX: -36, pointerId: 1 });
		act(() => vi.advanceTimersByTime(220));
		expect(stack.getAttribute("data-current-index")).toBe("1");
	});

});
