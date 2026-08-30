import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { animate } from "motion/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PhotoStack, type PhotoStackImage } from "./photo-stack";

vi.mock("motion/react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("motion/react")>();
	return { ...actual, animate: vi.fn(actual.animate) };
});

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

function fireTimedPointerEvent(
	target: Element,
	type: "down" | "move" | "up",
	init: PointerEventInit,
	timeStamp: number,
) {
	const event =
		type === "down"
			? createEvent.pointerDown(target, init)
			: type === "move"
				? createEvent.pointerMove(target, init)
				: createEvent.pointerUp(target, init);
	Object.defineProperty(event, "timeStamp", { value: timeStamp });
	fireEvent(target, event);
}

function expectXReset(call: readonly unknown[] | undefined, expectedX: number) {
	if (!call) throw new Error("缺少回弹动画调用");
	const [value, target] = call;
	if (
		typeof value !== "object" ||
		value === null ||
		!("get" in value) ||
		typeof value.get !== "function"
	) {
		throw new TypeError("回弹动画首参不是 MotionValue");
	}
	const current = value.get();
	if (typeof current !== "number" || typeof target !== "number") {
		throw new TypeError("回弹动画位置不是数值");
	}
	expect(current).toBeCloseTo(expectedX);
	expect(target).toBe(0);
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

	it("短距离快速轻扫也会按释放速度切换照片", () => {
		vi.useFakeTimers();
		render(<PhotoStack {...stackProps()} />);
		const stack = screen.getByRole("group");

		fireTimedPointerEvent(stack, "down", { button: 0, clientX: 200, pointerId: 1 }, 100);
		fireTimedPointerEvent(stack, "move", { clientX: 170, pointerId: 1 }, 300);
		fireTimedPointerEvent(stack, "move", { clientX: 140, pointerId: 1 }, 360);
		fireTimedPointerEvent(stack, "up", { clientX: 140, pointerId: 1 }, 430);
		act(() => vi.advanceTimersByTime(220));

		expect(stack.getAttribute("data-current-index")).toBe("1");
	});

	it("中等距离慢拖松手后也会提交切换", () => {
		vi.useFakeTimers();
		render(<PhotoStack {...stackProps()} />);
		const stack = screen.getByRole("group");

		fireTimedPointerEvent(stack, "down", { button: 0, clientX: 200, pointerId: 1 }, 100);
		fireTimedPointerEvent(stack, "move", { clientX: 130, pointerId: 1 }, 400);
		fireTimedPointerEvent(stack, "up", { clientX: 130, pointerId: 1 }, 500);
		act(() => vi.advanceTimersByTime(220));

		expect(stack.getAttribute("data-current-index")).toBe("1");
	});

	it("视觉阈值前释放会先补完拉出轨迹再插入后置槽", () => {
		vi.useFakeTimers();
		render(<PhotoStack {...stackProps()} />);
		const stack = screen.getByRole("group");

		fireTimedPointerEvent(stack, "down", { button: 0, clientX: 200, pointerId: 1 }, 100);
		fireTimedPointerEvent(stack, "move", { clientX: 110, pointerId: 1 }, 400);
		vi.mocked(animate).mockClear();
		fireTimedPointerEvent(stack, "up", { clientX: 110, pointerId: 1 }, 500);

		const [value, target] = vi.mocked(animate).mock.calls[0] ?? [];
		if (
			typeof value !== "object" ||
			value === null ||
			!("get" in value) ||
			typeof value.get !== "function"
		) {
			throw new TypeError("缺少旧顶卡横向插槽动画");
		}
		expect(value.get()).toBeCloseTo(-90);
		expect(target).toEqual([null, -224, expect.closeTo(-29.71696, 5)]);
	});

	it("自动补完拉出阶段时到达峰值才切换卡片层级", () => {
		vi.useFakeTimers();
		render(<PhotoStack {...stackProps()} />);
		const stack = screen.getByRole("group");
		const current = screen.getByRole("button", { name: "第一张" });
		const incoming = screen.getByRole("button", { name: "第二张" });

		fireTimedPointerEvent(stack, "down", { button: 0, clientX: 200, pointerId: 1 }, 100);
		fireTimedPointerEvent(stack, "move", { clientX: 110, pointerId: 1 }, 400);
		fireTimedPointerEvent(stack, "up", { clientX: 110, pointerId: 1 }, 500);
		expect(Number(current.getAttribute("data-card-z"))).toBe(100);
		expect(Number(incoming.getAttribute("data-card-z"))).toBe(69);

		act(() => vi.advanceTimersByTime(109));
		expect(Number(current.getAttribute("data-card-z"))).toBe(100);
		expect(Number(incoming.getAttribute("data-card-z"))).toBe(69);
		act(() => vi.advanceTimersByTime(1));
		expect(Number(current.getAttribute("data-card-z"))).toBe(90);
		expect(Number(incoming.getAttribute("data-card-z"))).toBe(100);

		act(() => vi.advanceTimersByTime(110));
		expect(stack.getAttribute("data-current-index")).toBe("1");
	});

	it("拖过视觉阈值后释放仍直接插入后置槽", () => {
		vi.useFakeTimers();
		render(<PhotoStack {...stackProps()} />);
		const stack = screen.getByRole("group");
		const current = screen.getByRole("button", { name: "第一张" });
		const incoming = screen.getByRole("button", { name: "第二张" });

		fireTimedPointerEvent(stack, "down", { button: 0, clientX: 300, pointerId: 1 }, 100);
		fireTimedPointerEvent(stack, "move", { clientX: 20, pointerId: 1 }, 300);
		expect(Number(current.getAttribute("data-card-z"))).toBe(90);
		expect(Number(incoming.getAttribute("data-card-z"))).toBe(100);

		vi.mocked(animate).mockClear();
		fireTimedPointerEvent(stack, "up", { clientX: 20, pointerId: 1 }, 350);
		const target = vi.mocked(animate).mock.calls[0]?.[1];
		if (typeof target !== "number") throw new TypeError("旧顶卡未直接插入后置槽");
		expect(target).toBeCloseTo(-29.71696, 5);
	});

	it("恰好在视觉峰值释放时直接插槽并立即切换层级", () => {
		vi.useFakeTimers();
		render(<PhotoStack {...stackProps()} />);
		const stack = screen.getByRole("group");
		const current = screen.getByRole("button", { name: "第一张" });
		const incoming = screen.getByRole("button", { name: "第二张" });

		fireTimedPointerEvent(stack, "down", { button: 0, clientX: 300, pointerId: 1 }, 100);
		fireTimedPointerEvent(stack, "move", { clientX: 80, pointerId: 1 }, 300);
		expect(Number(current.getAttribute("data-card-z"))).toBe(100);
		expect(Number(incoming.getAttribute("data-card-z"))).toBe(69);

		vi.mocked(animate).mockClear();
		fireTimedPointerEvent(stack, "up", { clientX: 76, pointerId: 1 }, 350);
		expect(Number(current.getAttribute("data-card-z"))).toBe(90);
		expect(Number(incoming.getAttribute("data-card-z"))).toBe(100);
		const target = vi.mocked(animate).mock.calls[0]?.[1];
		if (typeof target !== "number") throw new TypeError("峰值释放重复补拉");
		expect(target).toBeCloseTo(-29.71696, 5);

		act(() => vi.advanceTimersByTime(220));
		expect(stack.getAttribute("data-current-index")).toBe("1");
	});

	it("拖过视觉阈值后反向收回至释放阈值内会回弹", () => {
		vi.useFakeTimers();
		render(<PhotoStack {...stackProps()} />);
		const stack = screen.getByRole("group");

		fireTimedPointerEvent(stack, "down", { button: 0, clientX: 300, pointerId: 1 }, 100);
		fireTimedPointerEvent(stack, "move", { clientX: 20, pointerId: 1 }, 300);
		expect(stack.getAttribute("data-current-index")).toBe("0");
		fireTimedPointerEvent(stack, "up", { clientX: 250, pointerId: 1 }, 350);
		act(() => vi.runAllTimers());

		expect(stack.getAttribute("data-current-index")).toBe("0");
		expect(Number(stack.getAttribute("data-current-offset"))).toBe(0);
	});

	it("首尾越界拖动保留阻尼轨迹并在松手后回弹", () => {
		vi.useFakeTimers();
		render(<PhotoStack {...stackProps()} />);
		const stack = screen.getByRole("group");
		const setPointerCapture = vi.fn();
		const hasPointerCapture = vi.fn(() => true);
		const releasePointerCapture = vi.fn();
		Object.assign(stack, { setPointerCapture, hasPointerCapture, releasePointerCapture });

		fireEvent.pointerDown(stack, { button: 0, clientX: 100, pointerId: 1 });
		expect(setPointerCapture).toHaveBeenCalledWith(1);
		fireEvent.pointerMove(stack, { clientX: 360, pointerId: 1 });
		const firstBoundaryOffset = Number(stack.getAttribute("data-current-offset"));
		expect(firstBoundaryOffset).toBeGreaterThan(0);
		expect(firstBoundaryOffset).toBeLessThan(260);
		vi.mocked(animate).mockClear();
		fireEvent.pointerUp(stack, { clientX: 360, pointerId: 1 });
		const boundaryCalls = vi.mocked(animate).mock.calls;
		expectXReset(boundaryCalls[0], firstBoundaryOffset);
		const boundarySpring = { type: "spring", stiffness: 320, damping: 36 };
		expect(boundaryCalls[0]?.[2]).toMatchObject(boundarySpring);
		const followerCall = boundaryCalls.find(
			(call) => typeof call[1] === "number" && Math.abs(call[1] - 29.71696) < 0.001,
		);
		expect(followerCall?.[2]).toMatchObject(boundarySpring);
		const followerValue = followerCall?.[0];
		if (
			typeof followerValue !== "object" ||
			followerValue === null ||
			!("get" in followerValue) ||
			typeof followerValue.get !== "function"
		) {
			throw new TypeError("边界后卡未同步回弹");
		}
		expect(followerValue.get()).toBeGreaterThan(29.71696);
		expect(hasPointerCapture).toHaveBeenCalledWith(1);
		expect(releasePointerCapture).toHaveBeenCalledWith(1);
		act(() => vi.runAllTimers());
		expect(stack.getAttribute("data-current-index")).toBe("0");
		expect(stack.querySelectorAll('[data-card-state="right"]')).toHaveLength(3);
		expect(Number(stack.getAttribute("data-current-offset"))).toBe(0);

		for (let pointerId = 2; pointerId <= 4; pointerId += 1) {
			fireEvent.pointerDown(stack, { button: 0, clientX: 200, pointerId });
			fireEvent.pointerMove(stack, { clientX: -140, pointerId });
			fireEvent.pointerUp(stack, { clientX: -140, pointerId });
			act(() => vi.runAllTimers());
		}
		expect(stack.getAttribute("data-current-index")).toBe("3");

		setPointerCapture.mockClear();
		hasPointerCapture.mockClear();
		releasePointerCapture.mockClear();
		fireEvent.pointerDown(stack, { button: 0, clientX: 100, pointerId: 5 });
		expect(setPointerCapture).toHaveBeenCalledWith(5);
		fireEvent.pointerMove(stack, { clientX: 10, pointerId: 5 });
		const lastBoundaryOffset = Number(stack.getAttribute("data-current-offset"));
		expect(lastBoundaryOffset).toBeLessThan(0);
		expect(lastBoundaryOffset).toBeGreaterThan(-90);
		vi.mocked(animate).mockClear();
		fireEvent.pointerUp(stack, { clientX: 10, pointerId: 5 });
		expectXReset(vi.mocked(animate).mock.calls[0], lastBoundaryOffset);
		expect(hasPointerCapture).toHaveBeenCalledWith(5);
		expect(releasePointerCapture).toHaveBeenCalledWith(5);
		act(() => vi.runAllTimers());
		expect(stack.getAttribute("data-current-index")).toBe("3");
		expect(Number(stack.getAttribute("data-current-offset"))).toBe(0);
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

		// 2. 超出 4/5 阈值继续向左拉 (280px > 224px) -> 目标卡置顶 (100)，当前卡钻入底层 (90) 并平滑向左槽位 (-29.72px) 插回
		fireEvent.pointerMove(stack, { clientX: 20, pointerId: 1 });
		expect(Number(current.getAttribute("data-card-z"))).toBe(90);
		expect(Number(incoming.getAttribute("data-card-z"))).toBe(100);
		expect(Number(stack.getAttribute("data-current-offset"))).toBeCloseTo(-126.9, 1);

		// 3. 充分拖动 (336px = 280*1.2) -> 完全进入左侧后置槽位 (-29.72px)
		fireEvent.pointerMove(stack, { clientX: -36, pointerId: 1 });
		expect(Number(stack.getAttribute("data-current-offset"))).toBeCloseTo(-29.72, 1);
		fireEvent.pointerUp(stack, { clientX: -36, pointerId: 1 });
		act(() => vi.advanceTimersByTime(220));
		expect(stack.getAttribute("data-current-index")).toBe("1");
	});
});
