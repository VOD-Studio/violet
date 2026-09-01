import { act, createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
const sixImages: PhotoStackImage[] = [
	...images,
	{ src: "/five.jpg", alt: "第五张" },
	{ src: "/six.jpg", alt: "第六张" },
];
let restoreOffsetWidth: (() => void) | undefined;

afterEach(() => {
	restoreOffsetWidth?.();
	restoreOffsetWidth = undefined;
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
	it("默认急切加载顶图且允许调用方改为懒加载", () => {
		const { rerender } = render(<PhotoStack {...stackProps()} />);
		expect(screen.getByRole("img", { name: "第一张" }).getAttribute("loading")).toBe("eager");

		rerender(<PhotoStack {...stackProps()} loading="lazy" />);
		expect(screen.getByRole("img", { name: "第一张" }).getAttribute("loading")).toBe("lazy");
	});

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
		expect(
			[...stack.querySelectorAll<HTMLElement>("[data-card-depth]")].filter(
				(card) => Number(card.style.opacity) > 0.01,
			),
		).toHaveLength(3);
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

	it("折叠态保留全部真实卡片并显示完整数量", () => {
		render(<PhotoStack {...stackProps()} images={sixImages} />);
		const stack = screen.getByRole("group");

		expect(stack.getAttribute("aria-label")).toBe("第 1 项，共 6 项");
		expect(screen.getByRole("button", { name: "展开全部照片，共 6 张" })).toBeTruthy();
		expect(stack.querySelectorAll('[data-card-state="current"]')).toHaveLength(1);
		expect(
			stack.querySelectorAll('[data-card-state="left"], [data-card-state="right"]'),
		).toHaveLength(5);
		const secondRear = stack.querySelector<HTMLElement>('[data-card-depth="2"]');
		const hiddenRear = stack.querySelector<HTMLElement>('[data-card-depth="3"]');
		expect(secondRear?.style.opacity).toBe("1");
		expect(hiddenRear?.style.opacity).toBe("0");
		expect(
			[...stack.querySelectorAll<HTMLElement>("[data-card-depth]")].filter(
				(card) => Number(card.style.opacity) > 0.01,
			),
		).toHaveLength(3);
	});

	it("正反向拖拽阶段同步换槽并交叉淡入淡出后卡", async () => {
		render(<PhotoStack {...stackProps()} images={sixImages} />);
		const stack = screen.getByRole("group");
		let hiddenRear = stack.querySelector<HTMLElement>('[data-card-depth="3"]');

		fireEvent.pointerDown(stack, { button: 0, clientX: 300, pointerId: 1 });
		fireEvent.pointerMove(stack, { clientX: 180, pointerId: 1 });
		expect(hiddenRear?.style.opacity).toBe("0");
		fireEvent.pointerUp(stack, { clientX: 180, pointerId: 1 });
		await waitFor(() => expect(stack.getAttribute("data-current-index")).toBe("1"));
		hiddenRear = screen.getByRole("button", { name: "第四张" });
		expect(hiddenRear?.style.opacity).toBe("0");
		const fadingPrevious = screen.getByRole("button", { name: "第一张" });
		const previousTransform = fadingPrevious.style.transform;

		fireEvent.pointerDown(stack, { button: 0, clientX: 300, pointerId: 2 });
		fireEvent.pointerMove(stack, { clientX: 180, pointerId: 2 });
		await waitFor(() => {
			expect(Number(hiddenRear?.style.opacity)).toBeGreaterThan(0);
			expect(Number(hiddenRear?.style.opacity)).toBeLessThan(1);
			expect(Number(fadingPrevious.style.opacity)).toBeGreaterThan(0);
			expect(Number(fadingPrevious.style.opacity)).toBeLessThan(1);
			expect(fadingPrevious.style.transform).not.toBe(previousTransform);
		});
		fireEvent.pointerUp(stack, { clientX: 180, pointerId: 2 });

		await waitFor(() => {
			expect(Number(hiddenRear?.style.opacity)).toBeGreaterThan(0.99);
			expect(Number(fadingPrevious.style.opacity)).toBeLessThan(0.01);
		});

		const returningTransform = fadingPrevious.style.transform;
		fireEvent.pointerDown(stack, { button: 0, clientX: 100, pointerId: 3 });
		fireEvent.pointerMove(stack, { clientX: 220, pointerId: 3 });
		await waitFor(() => {
			expect(Number(fadingPrevious.style.opacity)).toBeGreaterThan(0);
			expect(Number(fadingPrevious.style.opacity)).toBeLessThan(1);
			expect(Number(hiddenRear?.style.opacity)).toBeGreaterThan(0);
			expect(Number(hiddenRear?.style.opacity)).toBeLessThan(1);
			expect(fadingPrevious.style.transform).not.toBe(returningTransform);
		});
		fireEvent.pointerUp(stack, { clientX: 220, pointerId: 3 });

		await waitFor(() => {
			expect(stack.getAttribute("data-current-index")).toBe("1");
			expect(Number(fadingPrevious.style.opacity)).toBeGreaterThan(0.99);
			expect(Number(hiddenRear?.style.opacity)).toBeLessThan(0.01);
		});
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

	it("视觉阈值前释放按当前位置小幅续冲后进入后置槽", () => {
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
		expect(target).toEqual([null, expect.closeTo(-145.6, 5), expect.closeTo(-29.71696, 5)]);
		const transition = vi.mocked(animate).mock.calls[0]?.[2];
		expect(transition).toMatchObject({
			duration: 0.22,
			times: [0, expect.closeTo(56 / 220, 5), 1],
		});
	});

	it("轻扫续冲到峰值时迅速切换卡片层级", () => {
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

		act(() => vi.advanceTimersByTime(55));
		expect(Number(current.getAttribute("data-card-z"))).toBe(100);
		act(() => vi.advanceTimersByTime(1));
		expect(stack.getAttribute("data-current-index")).toBe("1");
		expect(screen.getByRole("button", { name: "第一张" }).getAttribute("data-card-state")).toBe(
			"left",
		);
		expect(screen.getByRole("button", { name: "第二张" }).getAttribute("data-card-state")).toBe(
			"current",
		);

		act(() => vi.advanceTimersByTime(164));
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
		expect(stack.getAttribute("data-current-index")).toBe("1");
		expect(screen.getByRole("button", { name: "第一张" }).getAttribute("data-card-state")).toBe(
			"left",
		);
		expect(screen.getByRole("button", { name: "第二张" }).getAttribute("data-card-state")).toBe(
			"current",
		);
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
		const offsetWidthSpy = vi
			.spyOn(HTMLElement.prototype, "offsetWidth", "get")
			.mockReturnValue(280);
		restoreOffsetWidth = () => offsetWidthSpy.mockRestore();
		render(<PhotoStack {...stackProps()} />);
		const stack = screen.getByRole("group");
		act(() => vi.advanceTimersByTime(500));
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
		expect(followerValue.get()).not.toBeCloseTo(29.71696);
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
		expect(stack.getAttribute("data-current-index")).toBe("1");
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

	it("前一张仍在回槽时新顶卡即可接管下一次拖拽", () => {
		vi.useFakeTimers();
		const offsetWidthSpy = vi
			.spyOn(HTMLElement.prototype, "offsetWidth", "get")
			.mockReturnValue(280);
		restoreOffsetWidth = () => offsetWidthSpy.mockRestore();
		render(<PhotoStack {...stackProps()} />);
		const stack = screen.getByRole("group");
		act(() => vi.advanceTimersByTime(500));
		vi.mocked(animate).mockClear();

		fireTimedPointerEvent(stack, "down", { button: 0, clientX: 200, pointerId: 1 }, 100);
		fireTimedPointerEvent(stack, "move", { clientX: 110, pointerId: 1 }, 140);
		fireTimedPointerEvent(stack, "up", { clientX: 110, pointerId: 1 }, 160);
		const incomingXAnimation = vi.mocked(animate).mock.calls.find(([value, target]) => {
			if (
				target !== 0 ||
				typeof value !== "object" ||
				value === null ||
				!("get" in value) ||
				typeof value.get !== "function"
			)
				return false;
			return true;
		});
		const rearXAnimation = vi.mocked(animate).mock.calls.find(([value, target]) => {
			if (
				typeof target !== "number" ||
				Math.abs(target - 29.71696) > 0.001 ||
				typeof value !== "object" ||
				value === null ||
				!("get" in value) ||
				typeof value.get !== "function"
			)
				return false;
			return true;
		});
		const incomingX = incomingXAnimation?.[0];
		const rearX = rearXAnimation?.[0];
		if (
			typeof incomingX !== "object" ||
			incomingX === null ||
			!("get" in incomingX) ||
			typeof incomingX.get !== "function" ||
			!("set" in incomingX) ||
			typeof incomingX.set !== "function"
		)
			throw new TypeError("缺少新顶卡横向回中动画");
		if (
			typeof rearX !== "object" ||
			rearX === null ||
			!("get" in rearX) ||
			typeof rearX.get !== "function" ||
			!("set" in rearX) ||
			typeof rearX.set !== "function"
		)
			throw new TypeError("缺少后置卡换位动画");
		act(() => vi.advanceTimersByTime(56));
		expect(stack.getAttribute("data-current-index")).toBe("1");
		incomingX.set(18);
		rearX.set(45);

		fireTimedPointerEvent(stack, "down", { button: 0, clientX: 200, pointerId: 2 }, 260);
		const dragOrigin = incomingX.get();
		const rearOrigin = rearX.get();
		fireTimedPointerEvent(stack, "move", { clientX: 199, pointerId: 2 }, 290);
		expect(incomingX.get()).toBeCloseTo(dragOrigin - 1);
		expect(rearX.get()).toBeCloseTo(rearOrigin + (0 - rearOrigin) * (1 / 224));
		expect(Number(stack.getAttribute("data-current-offset"))).toBeCloseTo(dragOrigin - 1);
		expect(screen.getByRole("button", { name: "第二张" }).getAttribute("data-card-state")).toBe(
			"current",
		);
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
