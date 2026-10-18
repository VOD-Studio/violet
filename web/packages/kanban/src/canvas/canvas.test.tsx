import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewport } from "../core/index.ts";
import { notifyEditing, requestPan } from "../pan-region.ts";
import { Canvas, type CanvasHandle } from "./canvas.tsx";

const identity: Viewport = { scale: 1, x: 0, y: 0 };

/** 当前显示的视口：从内容层的 transform 读回。 */
function shown() {
	const content = document.querySelector(".v-kanban-canvas__content") as HTMLElement;
	const match = /translate\(([-\d.e]+)px, ([-\d.e]+)px\) scale\(([-\d.e]+)\)/.exec(
		content.style.transform,
	);
	if (!match) throw new Error(`Unexpected transform: ${content.style.transform}`);
	return { x: Number(match[1]), y: Number(match[2]), scale: Number(match[3]) };
}
const viewport = () => document.querySelector(".v-kanban-canvas__viewport") as HTMLElement;
const status = () => document.querySelector(".v-kanban-canvas__status")?.textContent;

/** jsdom 没有布局：让视口与内容有确定的尺寸。 */
function stubSizes(container: [number, number], content: [number, number]) {
	const client = (axis: 0 | 1) =>
		function (this: HTMLElement) {
			return this.classList.contains("v-kanban-canvas__viewport") ? container[axis] : 0;
		};
	const scroll = (axis: 0 | 1) =>
		function (this: HTMLElement) {
			return this.classList.contains("v-kanban-canvas__content") ? content[axis] : 0;
		};
	const spies = [
		vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(client(0)),
		vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(client(1)),
		vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(scroll(0)),
		vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(scroll(1)),
		vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(scroll(0)),
		vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(scroll(1)),
	];
	return () => {
		for (const spy of spies) spy.mockRestore();
	};
}

/** 让指针事件在视口坐标系里有确定位置：视口左上角在页面 (0,0)。 */
let resizeCallbacks: Array<() => void> = [];
beforeEach(() => {
	resizeCallbacks = [];
	vi.stubGlobal(
		"ResizeObserver",
		class {
			constructor(callback: () => void) {
				resizeCallbacks.push(callback);
			}
			observe() {}
			unobserve() {}
			disconnect() {}
		},
	);
});
afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	document.body.style.overflow = "";
});

const renderCanvas = (props: Partial<Parameters<typeof Canvas>[0]> = {}) =>
	render(
		<Canvas defaultViewport={identity} {...props}>
			<div data-testid="child" data-card-id="c1">
				<button type="button">inner</button>
			</div>
			<div data-testid="draggable" data-card-id="c2" data-draggable="true">
				draggable
			</div>
			<div data-testid="no-pan" data-kanban-no-pan>
				no pan
			</div>
			<input aria-label="field" />
			<p data-testid="background">background</p>
		</Canvas>,
	);

const wheel = (init: WheelEventInit) => {
	const event = new WheelEvent("wheel", {
		bubbles: true,
		cancelable: true,
		clientX: 0,
		clientY: 0,
		...init,
	});
	act(() => void viewport().dispatchEvent(event));
	return event;
};

describe("结构", () => {
	it("视口是带名称的可聚焦分组，关联操作说明，内容原样渲染", () => {
		renderCanvas();

		expect(viewport().getAttribute("role")).toBe("group");
		expect(viewport().getAttribute("aria-label")).toBe("Canvas");
		expect(viewport().getAttribute("tabindex")).toBe("0");
		const hint = document.getElementById(viewport().getAttribute("aria-describedby") ?? "");
		expect(hint?.textContent).toMatch(/arrow keys/i);
		expect(screen.getByTestId("child")).toBeTruthy();
	});

	it("没有给出初始视口时挂载后适应窗口：内容小于窗口，居中且不放大超过 100%", () => {
		const restore = stubSizes([1000, 600], [500, 300]);
		render(
			<Canvas>
				<div>content</div>
			</Canvas>,
		);

		expect(shown()).toEqual({ x: 250, y: 150, scale: 1 });
		restore();
	});

	it("内容远大于窗口：缩放停在 0.8，装不下的部分靠平移", () => {
		const restore = stubSizes([1000, 600], [2000, 600]);
		render(
			<Canvas>
				<div>wide</div>
			</Canvas>,
		);

		expect(shown()).toMatchObject({ scale: 0.8, x: 24 });
		restore();
	});

	it("窗口尺寸变化时重新适应，用户调整过视口之后不再自动适应", () => {
		let width = 1000;
		const restore = stubSizes([1000, 600], [500, 300]);
		vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (
			this: HTMLElement,
		) {
			return this.classList.contains("v-kanban-canvas__viewport") ? width : 0;
		});
		render(
			<Canvas>
				<div>content</div>
			</Canvas>,
		);
		expect(shown().x).toBe(250);

		width = 800;
		act(() => {
			for (const callback of resizeCallbacks) callback();
		});
		expect(shown().x).toBe(150);

		fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
		width = 1000;
		act(() => {
			for (const callback of resizeCallbacks) callback();
		});
		expect(shown().x).not.toBe(250);
		restore();
	});
});

describe("滚轮", () => {
	it("普通滚轮不被劫持：不阻止默认行为，视口不变", () => {
		renderCanvas();

		const event = wheel({ deltaY: 100 });

		expect(event.defaultPrevented).toBe(false);
		expect(shown()).toEqual(identity);
	});

	it("Ctrl 或 ⌘ 加滚轮缩放并阻止浏览器自己的页面缩放；向上放大，向下缩小", () => {
		renderCanvas();

		const zoomIn = wheel({ deltaY: -100, ctrlKey: true });
		expect(zoomIn.defaultPrevented).toBe(true);
		const zoomedIn = shown().scale;
		expect(zoomedIn).toBeGreaterThan(1);

		wheel({ deltaY: 200, metaKey: true });
		expect(shown().scale).toBeLessThan(zoomedIn);
	});

	it("缩放以指针位置为中心，并限制在 0.3 到 2", () => {
		renderCanvas();
		wheel({ deltaY: -100, ctrlKey: true, clientX: 300, clientY: 200 });
		const { scale, x, y } = shown();

		expect((300 - x) / scale).toBeCloseTo(300, 6);
		expect((200 - y) / scale).toBeCloseTo(200, 6);

		for (let i = 0; i < 40; i += 1) wheel({ deltaY: -400, ctrlKey: true });
		expect(shown().scale).toBe(2);
		for (let i = 0; i < 80; i += 1) wheel({ deltaY: 400, ctrlKey: true });
		expect(shown().scale).toBe(0.3);
	});

	it("控件条上的 Ctrl 加滚轮同样被接管：不缩放整个页面", () => {
		renderCanvas();
		const controls = document.querySelector(".v-kanban-canvas__controls") as HTMLElement;
		const event = new WheelEvent("wheel", {
			bubbles: true,
			cancelable: true,
			ctrlKey: true,
			deltaY: -100,
		});

		act(() => void controls.dispatchEvent(event));

		expect(event.defaultPrevented).toBe(true);
		expect(shown().scale).toBeGreaterThan(1);
	});

	describe("Safari 触控板捏合", () => {
		const gesture = (
			type: string,
			init: { scale?: number; clientX?: number; clientY?: number },
		) => {
			const event = Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
				scale: 1,
				clientX: 0,
				clientY: 0,
				...init,
			});
			act(() => void viewport().dispatchEvent(event));
			return event;
		};

		it("按手势倍数缩放并阻止页面缩放；倍数相对手势开始时的视口", () => {
			renderCanvas();

			expect(gesture("gesturestart", {}).defaultPrevented).toBe(true);
			expect(gesture("gesturechange", { scale: 1.5 }).defaultPrevented).toBe(true);
			expect(shown().scale).toBe(1.5);
			gesture("gesturechange", { scale: 1.2 });
			expect(shown().scale).toBe(1.2);
			gesture("gestureend", {});
		});

		it("触屏正在按着时不处理：那是指针事件负责的双指捏合", () => {
			renderCanvas();
			act(
				() =>
					void screen.getByTestId("background").dispatchEvent(
						new PointerEvent("pointerdown", {
							bubbles: true,
							pointerId: 1,
							pointerType: "touch",
							clientX: 10,
							clientY: 10,
						}),
					),
			);

			gesture("gesturestart", {});
			gesture("gesturechange", { scale: 2 });

			expect(shown().scale).toBe(1);
		});
	});
});

describe("按钮", () => {
	it("放大、缩小与适应窗口，读数与播报随之更新", () => {
		const restore = stubSizes([1000, 600], [500, 300]);
		renderCanvas();

		fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
		expect(shown().scale).toBe(1.25);
		expect(screen.getByText("125%")).toBeTruthy();
		expect(status()).toBe("Zoom 125%");

		fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
		fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
		expect(shown().scale).toBeCloseTo(0.8, 6);

		fireEvent.click(screen.getByRole("button", { name: "Fit to window" }));
		expect(shown()).toEqual({ x: 250, y: 150, scale: 1 });
		restore();
	});

	it("到达缩放上下限时对应按钮不可用，但仍可聚焦（不用 disabled）", () => {
		renderCanvas({ defaultViewport: { scale: 2, x: 0, y: 0 } });

		const zoomIn = screen.getByRole("button", { name: "Zoom in" });
		expect(zoomIn.getAttribute("aria-disabled")).toBe("true");
		expect(zoomIn.hasAttribute("disabled")).toBe(false);
		fireEvent.click(zoomIn);
		expect(shown().scale).toBe(2);
	});

	it("可用 controls=false 隐藏控件条", () => {
		renderCanvas({ controls: false });

		expect(screen.queryByRole("button", { name: "Zoom in" })).toBeNull();
	});

	it("zh-CN 与 messages 覆盖", () => {
		renderCanvas({ locale: "zh-CN" });
		expect(screen.getByRole("button", { name: "放大" })).toBeTruthy();
		expect(viewport().getAttribute("aria-label")).toBe("画布");
	});

	it("缩放读数不是第二个 live 区域：只有一个 status，避免同一次缩放读两遍", () => {
		renderCanvas();

		expect(screen.getAllByRole("status")).toHaveLength(1);
	});

	it("仅图标的按钮都有 title，适应窗口与全屏的图标不同", () => {
		renderCanvas();
		const buttons = screen.getAllByRole("button", { name: /zoom|fit|full screen/i });
		const icon = (name: RegExp) =>
			screen.getByRole("button", { name }).querySelector("path")?.getAttribute("d");

		for (const button of buttons) {
			expect(button.getAttribute("title")).toBe(button.getAttribute("aria-label"));
		}
		expect(icon(/fit/i)).not.toBe(icon(/enter full screen/i));
		fireEvent.click(screen.getByRole("button", { name: "Enter full screen" }));
		expect(icon(/exit full screen/i)).not.toBe(icon(/fit/i));
	});
});

describe("键盘", () => {
	it("视口聚焦时：方向键平移（Shift 加速），+ 与 - 缩放，0 适应窗口", () => {
		const restore = stubSizes([1000, 600], [500, 300]);
		renderCanvas();
		viewport().focus();

		fireEvent.keyDown(viewport(), { key: "ArrowRight" });
		expect(shown().x).toBe(-48);
		fireEvent.keyDown(viewport(), { key: "ArrowDown", shiftKey: true });
		expect(shown().y).toBe(-192);
		fireEvent.keyDown(viewport(), { key: "+" });
		expect(shown().scale).toBe(1.25);
		fireEvent.keyDown(viewport(), { key: "-" });
		fireEvent.keyDown(viewport(), { key: "-" });
		expect(shown().scale).toBeCloseTo(0.8, 6);
		fireEvent.keyDown(viewport(), { key: "0" });
		expect(shown()).toEqual({ x: 250, y: 150, scale: 1 });
		restore();
	});

	it("0 适应窗口并像按钮一样播报缩放", () => {
		const restore = stubSizes([1000, 600], [500, 300]);
		renderCanvas({ defaultViewport: { scale: 1.5, x: 0, y: 0 } });

		fireEvent.keyDown(viewport(), { key: "0" });

		expect(status()).toBe("Zoom 100%");
		restore();
	});

	it("发给内容里元素的按键、带修饰键的按键不被接管", () => {
		renderCanvas();

		const inner = fireEvent.keyDown(screen.getByRole("button", { name: "inner" }), {
			key: "ArrowRight",
		});
		const modified = fireEvent.keyDown(viewport(), { key: "ArrowRight", ctrlKey: true });

		expect(inner).toBe(true);
		expect(modified).toBe(true);
		expect(shown()).toEqual(identity);
	});

	it("方向键被接管时阻止页面滚动", () => {
		renderCanvas();

		const notPrevented = fireEvent.keyDown(viewport(), { key: "ArrowDown" });

		expect(notPrevented).toBe(false);
	});
});

describe("拖动背景平移", () => {
	const pointer = (type: string, init: PointerEventInit) =>
		new PointerEvent(type, {
			bubbles: true,
			cancelable: true,
			pointerType: "mouse",
			isPrimary: true,
			button: 0,
			...init,
		});

	it("在背景上按下并移动超过阈值即平移，松开结束", () => {
		renderCanvas();
		const background = screen.getByTestId("background");

		act(
			() =>
				void background.dispatchEvent(
					pointer("pointerdown", { pointerId: 1, clientX: 100, clientY: 100 }),
				),
		);
		act(
			() =>
				void background.dispatchEvent(
					pointer("pointermove", { pointerId: 1, clientX: 102, clientY: 101 }),
				),
		);
		expect(shown()).toEqual(identity);

		act(
			() =>
				void background.dispatchEvent(
					pointer("pointermove", { pointerId: 1, clientX: 140, clientY: 130 }),
				),
		);
		expect(shown()).toEqual({ scale: 1, x: 40, y: 30 });
		expect(viewport().getAttribute("data-panning")).toBe("true");

		act(
			() =>
				void background.dispatchEvent(
					pointer("pointerup", { pointerId: 1, clientX: 140, clientY: 130 }),
				),
		);
		expect(viewport().hasAttribute("data-panning")).toBe(false);
	});

	/** 在 target 上按下、移动 80px、抬起，返回之后显示的视口。 */
	const dragFrom = (target: Element, pointerType: "mouse" | "touch") => {
		for (const [type, clientX] of [
			["pointerdown", 0],
			["pointermove", 80],
			["pointerup", 80],
		] as const) {
			act(
				() =>
					void target.dispatchEvent(
						pointer(type, { pointerId: 1, pointerType, clientX, clientY: 0 }),
					),
			);
		}
		return shown();
	};

	it("鼠标在按钮、可拖卡片、输入框与带 data-kanban-no-pan 的元素上按下不平移", () => {
		renderCanvas();

		for (const target of [
			screen.getByRole("button", { name: "inner" }),
			screen.getByTestId("draggable"),
			screen.getByTestId("no-pan"),
			screen.getByRole("textbox", { name: "field" }),
		]) {
			expect(dragFrom(target, "mouse")).toEqual(identity);
		}
	});

	it("不可拖的卡片是内容的一部分：鼠标可以从它上面起手平移", () => {
		renderCanvas();

		expect(dragFrom(screen.getByTestId("child"), "mouse")).toEqual({ scale: 1, x: 80, y: 0 });
	});

	it("触屏没有别的滚动手段：可以从按钮上起手平移；输入框与 data-kanban-no-pan 仍归自己", () => {
		renderCanvas();
		for (const target of [
			screen.getByTestId("no-pan"),
			screen.getByRole("textbox", { name: "field" }),
		]) {
			expect(dragFrom(target, "touch")).toEqual(identity);
		}

		expect(dragFrom(screen.getByRole("button", { name: "inner" }), "touch")).toEqual({
			scale: 1,
			x: 80,
			y: 0,
		});
	});

	describe("触屏从可拖卡片上起手", () => {
		const touchMove = (target: Element, id: number, x: number) =>
			act(
				() =>
					void target.dispatchEvent(
						pointer("pointermove", {
							pointerId: id,
							pointerType: "touch",
							clientX: x,
							clientY: 0,
						}),
					),
			);
		const touchDown = (target: Element, id: number, x = 0) =>
			act(
				() =>
					void target.dispatchEvent(
						pointer("pointerdown", {
							pointerId: id,
							pointerType: "touch",
							clientX: x,
							clientY: 0,
						}),
					),
			);

		it("看板在等长按（data-kanban-holding）时不平移；看板放弃长按之后才平移，从按下处算起", () => {
			renderCanvas();
			const draggable = screen.getByTestId("draggable");
			const content = document.querySelector(".v-kanban-canvas__content") as HTMLElement;
			touchDown(draggable, 1);
			content.setAttribute("data-kanban-holding", "true");

			touchMove(draggable, 1, 8);
			touchMove(draggable, 1, 40);
			expect(shown()).toEqual(identity);

			content.removeAttribute("data-kanban-holding");
			touchMove(draggable, 1, 50);
			expect(shown()).toEqual({ scale: 1, x: 50, y: 0 });
		});

		it("没有长按在等：移动超过一般的平移阈值就平移", () => {
			renderCanvas();
			const draggable = screen.getByTestId("draggable");

			touchDown(draggable, 1);
			touchMove(draggable, 1, 2);
			expect(shown()).toEqual(identity);
			touchMove(draggable, 1, 12);

			expect(shown()).toEqual({ scale: 1, x: 12, y: 0 });
		});

		it("看板正在拖拽时，新落下的手指不开始任何手势", () => {
			renderCanvas();
			const background = screen.getByTestId("background");
			const draggable = screen.getByTestId("draggable");
			touchDown(draggable, 1);
			document
				.querySelector(".v-kanban-canvas__content")
				?.setAttribute("data-dragging", "true");

			touchDown(background, 2, 100);
			touchMove(background, 2, 300);
			touchMove(draggable, 1, 0);

			expect(shown()).toEqual(identity);
		});

		it("看板已经开始拖拽：画布让出这根手指，不再平移", () => {
			renderCanvas();
			const draggable = screen.getByTestId("draggable");
			touchDown(draggable, 1);

			document
				.querySelector(".v-kanban-canvas__content")
				?.setAttribute("data-dragging", "true");
			touchMove(draggable, 1, 80);
			touchMove(draggable, 1, 120);

			expect(shown()).toEqual(identity);
			expect(viewport().hasAttribute("data-panning")).toBe(false);
		});

		it("鼠标从可拖卡片上按下仍归卡片", () => {
			renderCanvas();

			expect(dragFrom(screen.getByTestId("draggable"), "mouse")).toEqual(identity);
		});
	});

	it("pointercancel 同样结束平移", () => {
		renderCanvas();
		const background = screen.getByTestId("background");
		act(
			() =>
				void background.dispatchEvent(
					pointer("pointerdown", { pointerId: 1, clientX: 0, clientY: 0 }),
				),
		);
		act(
			() =>
				void background.dispatchEvent(
					pointer("pointermove", { pointerId: 1, clientX: 50, clientY: 0 }),
				),
		);

		act(() => void background.dispatchEvent(pointer("pointercancel", { pointerId: 1 })));

		expect(viewport().hasAttribute("data-panning")).toBe(false);
	});

	it("触屏双指：间距变化缩放，两指一起移动平移", () => {
		renderCanvas();
		const background = screen.getByTestId("background");
		const touch = (type: string, pointerId: number, clientX: number, clientY: number) =>
			act(
				() =>
					void background.dispatchEvent(
						pointer(type, {
							pointerId,
							pointerType: "touch",
							isPrimary: pointerId === 1,
							clientX,
							clientY,
						}),
					),
			);

		touch("pointerdown", 1, 100, 100);
		touch("pointerdown", 2, 200, 100);
		touch("pointermove", 1, 50, 100);
		touch("pointermove", 2, 250, 100);

		expect(shown()).toEqual({ scale: 2, x: -150, y: -100 });
	});
});

describe("全屏", () => {
	it("按钮进入与退出全屏：标记、按钮名称、播报与页面滚动锁定同步", () => {
		const { container } = renderCanvas();

		fireEvent.click(screen.getByRole("button", { name: "Enter full screen" }));
		expect(container.querySelector(".v-kanban-canvas")?.getAttribute("data-fullscreen")).toBe(
			"true",
		);
		expect(document.body.style.overflow).toBe("hidden");
		expect(status()).toMatch(/Escape/);

		fireEvent.click(screen.getByRole("button", { name: "Exit full screen" }));
		expect(container.querySelector(".v-kanban-canvas")?.hasAttribute("data-fullscreen")).toBe(
			false,
		);
		expect(document.body.style.overflow).toBe("");
	});

	it("Esc 退出全屏；已被别处（拖拽、键盘拿起）接管的 Esc 不会同时退出全屏", () => {
		renderCanvas();
		fireEvent.click(screen.getByRole("button", { name: "Enter full screen" }));

		const swallow = (event: Event) => event.stopPropagation();
		document.addEventListener("keydown", swallow, true);
		fireEvent.keyDown(document.body, { key: "Escape" });
		document.removeEventListener("keydown", swallow, true);
		expect(document.querySelector(".v-kanban-canvas")?.getAttribute("data-fullscreen")).toBe(
			"true",
		);

		fireEvent.keyDown(document.body, { key: "Escape" });
		expect(document.querySelector(".v-kanban-canvas")?.hasAttribute("data-fullscreen")).toBe(
			false,
		);
	});

	it("已经被调用了 preventDefault 的 Esc 不退出全屏", () => {
		renderCanvas();
		fireEvent.click(screen.getByRole("button", { name: "Enter full screen" }));
		const claim = (event: Event) => event.preventDefault();
		document.addEventListener("keydown", claim, true);

		fireEvent.keyDown(document.body, { key: "Escape" });
		document.removeEventListener("keydown", claim, true);

		expect(document.querySelector(".v-kanban-canvas")?.getAttribute("data-fullscreen")).toBe(
			"true",
		);
	});

	it("卸载时恢复页面滚动", () => {
		const view = renderCanvas();
		fireEvent.click(screen.getByRole("button", { name: "Enter full screen" }));

		view.unmount();

		expect(document.body.style.overflow).toBe("");
	});

	it("全屏期间页面其余内容不可聚焦、不被读到；退出与卸载时恢复", () => {
		const outside = document.createElement("button");
		const wrapper = document.createElement("div");
		const sibling = document.createElement("p");
		document.body.append(outside, wrapper);
		wrapper.append(sibling);
		const view = render(
			<Canvas defaultViewport={identity}>
				<p>content</p>
			</Canvas>,
			{ container: wrapper.appendChild(document.createElement("div")) },
		);

		fireEvent.click(screen.getByRole("button", { name: "Enter full screen" }));
		expect(outside.hasAttribute("inert")).toBe(true);
		expect(sibling.hasAttribute("inert")).toBe(true);
		expect(view.container.closest("[inert]")).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "Exit full screen" }));
		expect(outside.hasAttribute("inert")).toBe(false);
		expect(sibling.hasAttribute("inert")).toBe(false);

		fireEvent.click(screen.getByRole("button", { name: "Enter full screen" }));
		view.unmount();
		expect(outside.hasAttribute("inert")).toBe(false);
		outside.remove();
		wrapper.remove();
	});

	it("onFullscreenChange 在进入与退出时调用", () => {
		const onFullscreenChange = vi.fn();
		renderCanvas({ onFullscreenChange });

		fireEvent.click(screen.getByRole("button", { name: "Enter full screen" }));
		fireEvent.click(screen.getByRole("button", { name: "Exit full screen" }));

		expect(onFullscreenChange.mock.calls).toEqual([[true], [false]]);
	});
});

describe("聚焦露出", () => {
	it("聚焦到视口之外的元素时平移到刚好露出，聚焦环不被裁剪", () => {
		const restore = stubSizes([800, 600], [2000, 600]);
		render(
			<Canvas defaultViewport={identity}>
				<button type="button">far</button>
			</Canvas>,
		);
		const far = screen.getByRole("button", { name: "far" });
		vi.spyOn(far, "getBoundingClientRect").mockReturnValue({
			left: 900,
			top: 100,
			right: 1000,
			bottom: 140,
			width: 100,
			height: 40,
			x: 900,
			y: 100,
			toJSON() {},
		} as DOMRect);
		vi.spyOn(viewport(), "getBoundingClientRect").mockReturnValue({
			left: 0,
			top: 0,
			right: 800,
			bottom: 600,
			width: 800,
			height: 600,
			x: 0,
			y: 0,
			toJSON() {},
		} as DOMRect);

		act(() => far.focus());

		expect(shown().x).toBe(-208);
		restore();
	});

	it("缩放过渡进行中聚焦：先让过渡落到终点再量位置，量完恢复", () => {
		const restore = stubSizes([800, 600], [2000, 600]);
		render(
			<Canvas defaultViewport={identity}>
				<button type="button">far</button>
			</Canvas>,
		);
		const content = document.querySelector(".v-kanban-canvas__content") as HTMLElement;
		const far = screen.getByRole("button", { name: "far" });
		const seen: string[] = [];
		vi.spyOn(far, "getBoundingClientRect").mockImplementation(() => {
			seen.push(content.style.transition);
			return new DOMRect(10, 10, 100, 40);
		});

		act(() => far.focus());

		expect(seen).toEqual(["none"]);
		expect(content.style.transition).toBe("");
		restore();
	});
});

describe("看板请求平移", () => {
	it("视口带有可平移区域标记，里面的看板据此找到它", () => {
		renderCanvas();

		expect(viewport().hasAttribute("data-kanban-pan-region")).toBe(true);
	});

	it("按请求平移，并在事件派发返回前画面就已更新（看板紧接着要量位置）", () => {
		const restore = stubSizes([800, 600], [2000, 1500]);
		renderCanvas();
		let during: Viewport | null = null;

		act(() => {
			requestPan(screen.getByTestId("background"), -100, -50);
			during = shown();
		});

		expect(during).toEqual({ scale: 1, x: -100, y: -50 });
		expect(shown()).toEqual({ scale: 1, x: -100, y: -50 });
		restore();
	});

	it("平移到内容尽头就停：起始边离容器 24px，末边也是", () => {
		const restore = stubSizes([800, 600], [2000, 1500]);
		renderCanvas();

		act(() => requestPan(screen.getByTestId("background"), 500, 500));
		expect(shown()).toEqual({ scale: 1, x: 24, y: 24 });

		act(() => requestPan(screen.getByTestId("background"), -5000, -5000));
		expect(shown()).toEqual({ scale: 1, x: -1224, y: -924 });
		restore();
	});

	it("算作用户调整：之后窗口尺寸变化不再自动适应；onViewportChange 被调用", () => {
		const restore = stubSizes([800, 600], [2000, 1500]);
		const onViewportChange = vi.fn();
		render(
			<Canvas onViewportChange={onViewportChange}>
				<p data-testid="background">background</p>
			</Canvas>,
		);
		onViewportChange.mockClear();

		act(() => requestPan(screen.getByTestId("background"), -10, 0));
		const panned = shown();
		act(() => {
			for (const callback of resizeCallbacks) callback();
		});

		expect(onViewportChange).toHaveBeenCalledWith(expect.objectContaining({ x: panned.x }));
		expect(shown()).toEqual(panned);
		restore();
	});

	it("requestPan 返回画布是否真的动了：到内容尽头再请求就是 false", () => {
		const restore = stubSizes([800, 600], [2000, 1500]);
		renderCanvas();
		const background = screen.getByTestId("background");
		let moved: boolean[] = [];

		act(() => {
			moved = [
				requestPan(background, -100, 0),
				requestPan(background, 0, 0),
				requestPan(background, 5000, 0),
				requestPan(background, 100, 0),
			];
		});

		expect(moved).toEqual([true, false, true, false]);
		restore();
	});

	it("没有画布时 requestPan 返回 false", () => {
		const element = document.createElement("div");

		expect(requestPan(element, 10, 0)).toBe(false);
	});

	it("看板里开始编辑（拖拽）之后，窗口或内容尺寸变化不再自动适应", () => {
		const restore = stubSizes([800, 600], [500, 300]);
		render(
			<Canvas>
				<p data-testid="background">background</p>
			</Canvas>,
		);
		const fitted = shown();

		notifyEditing(screen.getByTestId("background"));
		restore();
		const restoreBigger = stubSizes([800, 600], [2000, 1500]);
		act(() => {
			for (const callback of resizeCallbacks) callback();
		});

		expect(shown()).toEqual(fitted);
		restoreBigger();
	});

	it("没有开始编辑时，内容尺寸变化仍然重新适应", () => {
		const restore = stubSizes([800, 600], [500, 300]);
		render(
			<Canvas>
				<p>content</p>
			</Canvas>,
		);
		const fitted = shown();
		restore();
		const restoreBigger = stubSizes([800, 600], [2000, 1500]);

		act(() => {
			for (const callback of resizeCallbacks) callback();
		});

		expect(shown()).not.toEqual(fitted);
		restoreBigger();
	});

	it("内层画布先处理，不再冒泡给外层", () => {
		const restore = stubSizes([800, 600], [2000, 1500]);
		render(
			<Canvas defaultViewport={identity}>
				<Canvas defaultViewport={identity}>
					<p data-testid="inner">inner</p>
				</Canvas>
			</Canvas>,
		);
		const [outer, inner] = [...document.querySelectorAll(".v-kanban-canvas__content")];

		act(() => requestPan(screen.getByTestId("inner"), -30, 0));

		expect((outer as HTMLElement).style.transform).toContain("translate(0px, 0px)");
		expect((inner as HTMLElement).style.transform).toContain("translate(-30px");
		restore();
	});
});

describe("命令式句柄与回调", () => {
	it("ref 提供 fit、zoomIn、zoomOut 与读写视口；视口变化触发 onViewportChange", () => {
		const restore = stubSizes([1000, 600], [500, 300]);
		const ref = createRef<CanvasHandle>();
		const onViewportChange = vi.fn();
		renderCanvas({ ref, onViewportChange });

		act(() => ref.current?.zoomIn());
		expect(shown().scale).toBe(1.25);
		expect(onViewportChange).toHaveBeenLastCalledWith(expect.objectContaining({ scale: 1.25 }));

		act(() => ref.current?.setViewport({ scale: 0.5, x: 10, y: 20 }));
		expect(ref.current?.getViewport()).toEqual({ scale: 0.5, x: 10, y: 20 });

		act(() => ref.current?.fit());
		expect(shown()).toEqual({ x: 250, y: 150, scale: 1 });
		restore();
	});

	it("程序给出的视口会被校正：缩放收敛到范围内，非有限值不会让画布变成 NaN", () => {
		const ref = createRef<CanvasHandle>();
		renderCanvas({ ref });

		act(() => ref.current?.setViewport({ scale: 0, x: Number.NaN, y: 5 }));
		expect(ref.current?.getViewport()).toEqual({ scale: 0.3, x: 0, y: 5 });

		act(() => ref.current?.setViewport({ scale: 5, x: 1, y: 2 }));
		expect(ref.current?.getViewport().scale).toBe(2);
		act(() => ref.current?.zoomOut());
		expect(Number.isFinite(shown().x)).toBe(true);
	});

	it("defaultViewport 同样被校正", () => {
		renderCanvas({ defaultViewport: { scale: 9, x: 0, y: 0 } });

		expect(shown().scale).toBe(2);
	});
});

describe("服务端渲染", () => {
	it("标记可以直接水合，没有告警与恢复性错误", async () => {
		const canvas = (
			<Canvas defaultViewport={identity}>
				<p>content</p>
			</Canvas>
		);
		const container = document.createElement("div");
		container.innerHTML = renderToString(canvas);
		document.body.append(container);
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});
		const recoverable = vi.fn();

		await act(async () => {
			hydrateRoot(container, canvas, { onRecoverableError: recoverable });
		});

		expect(errors).not.toHaveBeenCalled();
		expect(recoverable).not.toHaveBeenCalled();
		errors.mockRestore();
		container.remove();
	});
});
