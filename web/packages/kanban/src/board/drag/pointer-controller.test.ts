import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPointerController } from "./pointer-controller.ts";
import type { DragHost } from "./types.ts";

function pointer(type: string, init: PointerEventInit = {}) {
	return new PointerEvent(type, {
		bubbles: true,
		cancelable: true,
		pointerId: 1,
		pointerType: "mouse",
		isPrimary: true,
		button: 0,
		...init,
	});
}

const detachers: Array<() => void> = [];

function setup(options?: Parameters<typeof createPointerController>[0]) {
	const root = document.createElement("div");
	root.innerHTML = `<div data-card-id="a" id="card"><span id="inner">A</span></div><div id="outside"></div>`;
	document.body.append(root);
	const calls: unknown[][] = [];
	const host: DragHost = {
		root,
		cardIdFor: (target) =>
			(target as Element | null)?.closest?.("[data-card-id]")?.getAttribute("data-card-id") ??
			null,
		start: (...args) => calls.push(["start", ...args]),
		move: (...args) => calls.push(["move", ...args]),
		drop: () => calls.push(["drop"]),
		cancel: () => calls.push(["cancel"]),
	};
	const detach = createPointerController(options).attach(host);
	detachers.push(detach);
	const card = root.querySelector<HTMLElement>("#card") as HTMLElement;
	return { root, card, calls, detach };
}

afterEach(() => {
	for (const detach of detachers.splice(0)) detach();
	document.body.innerHTML = "";
	vi.useRealTimers();
});

describe("鼠标", () => {
	it("移动不超过 4px 不开始拖拽，松开后点击照常发生", () => {
		const { card, calls } = setup();
		const onClick = vi.fn();
		card.addEventListener("click", onClick);

		card.dispatchEvent(pointer("pointerdown", { clientX: 10, clientY: 10 }));
		document.dispatchEvent(pointer("pointermove", { clientX: 12, clientY: 13 }));
		document.dispatchEvent(pointer("pointerup", { clientX: 12, clientY: 13 }));
		card.click();

		expect(calls).toEqual([]);
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("超过 4px 才开始：以按下点开始，再移动到当前位置，之后跟随指针", () => {
		const { card, calls } = setup();

		card.dispatchEvent(pointer("pointerdown", { clientX: 10, clientY: 10 }));
		document.dispatchEvent(pointer("pointermove", { clientX: 16, clientY: 10 }));
		document.dispatchEvent(pointer("pointermove", { clientX: 40, clientY: 50 }));

		expect(calls).toEqual([
			["start", "a", { x: 10, y: 10 }],
			["move", { x: 16, y: 10 }],
			["move", { x: 40, y: 50 }],
		]);
	});

	it("松开时放下，随之而来的点击被抑制，下一次点击恢复", async () => {
		const { card, calls } = setup();
		const onClick = vi.fn();
		card.addEventListener("click", onClick);

		card.dispatchEvent(pointer("pointerdown", { clientX: 0, clientY: 0 }));
		document.dispatchEvent(pointer("pointermove", { clientX: 30, clientY: 0 }));
		document.dispatchEvent(pointer("pointerup", { clientX: 30, clientY: 0 }));
		card.click();

		expect(calls.at(-1)).toEqual(["drop"]);
		expect(onClick).not.toHaveBeenCalled();

		await new Promise((resolve) => setTimeout(resolve, 0));
		card.click();
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("拖拽过程中按 Esc 取消，且 Esc 不再传给页面其他监听", () => {
		const { card, calls } = setup();
		const pageHandler = vi.fn();
		window.addEventListener("keydown", pageHandler);

		card.dispatchEvent(pointer("pointerdown", { clientX: 0, clientY: 0 }));
		document.dispatchEvent(pointer("pointermove", { clientX: 30, clientY: 0 }));
		document.dispatchEvent(
			new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
		);
		document.dispatchEvent(pointer("pointerup", { clientX: 30, clientY: 0 }));

		expect(calls.map((call) => call[0])).toEqual(["start", "move", "cancel"]);
		expect(pageHandler).not.toHaveBeenCalled();
		window.removeEventListener("keydown", pageHandler);
	});

	it("没有拖拽时 Esc 不被拦截", () => {
		setup();
		const pageHandler = vi.fn();
		window.addEventListener("keydown", pageHandler);

		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

		expect(pageHandler).toHaveBeenCalledTimes(1);
		window.removeEventListener("keydown", pageHandler);
	});

	it("pointercancel 与窗口失焦都取消拖拽", () => {
		for (const interrupt of [
			() => document.dispatchEvent(pointer("pointercancel")),
			() => window.dispatchEvent(new Event("blur")),
		]) {
			const { card, calls, detach } = setup();
			card.dispatchEvent(pointer("pointerdown", { clientX: 0, clientY: 0 }));
			document.dispatchEvent(pointer("pointermove", { clientX: 30, clientY: 0 }));

			interrupt();

			expect(calls.map((call) => call[0])).toEqual(["start", "move", "cancel"]);
			detach();
			document.body.innerHTML = "";
		}
	});

	it("只响应主按钮，忽略卡片之外的按下与次要指针", () => {
		const { root, card, calls } = setup();

		card.dispatchEvent(pointer("pointerdown", { button: 2 }));
		card.dispatchEvent(pointer("pointerdown", { isPrimary: false }));
		root.querySelector("#outside")?.dispatchEvent(pointer("pointerdown"));
		document.dispatchEvent(pointer("pointermove", { clientX: 100, clientY: 100 }));

		expect(calls).toEqual([]);
	});

	it("卸载后不再响应", () => {
		const { card, calls, detach } = setup();

		detach();
		card.dispatchEvent(pointer("pointerdown", { clientX: 0, clientY: 0 }));
		document.dispatchEvent(pointer("pointermove", { clientX: 50, clientY: 0 }));

		expect(calls).toEqual([]);
	});

	it("阻止浏览器原生拖拽与文字选择抢走指针", () => {
		const { card } = setup();
		card.dispatchEvent(pointer("pointerdown", { clientX: 0, clientY: 0 }));

		const dragstart = new Event("dragstart", { bubbles: true, cancelable: true });
		const selectstart = new Event("selectstart", { bubbles: true, cancelable: true });
		card.dispatchEvent(dragstart);
		card.dispatchEvent(selectstart);

		expect(dragstart.defaultPrevented).toBe(true);
		expect(selectstart.defaultPrevented).toBe(true);
	});
});

describe("鼠标：边界与点击抑制", () => {
	it("恰好移动 4px 还不算拖拽，超过才开始", () => {
		const { card, calls } = setup();

		card.dispatchEvent(pointer("pointerdown", { clientX: 0, clientY: 0 }));
		document.dispatchEvent(pointer("pointermove", { clientX: 4, clientY: 0 }));
		expect(calls).toEqual([]);

		document.dispatchEvent(pointer("pointermove", { clientX: 5, clientY: 0 }));
		expect(calls.map((call) => call[0])).toEqual(["start", "move"]);
	});

	it("Esc 取消时鼠标键还按着：之后补发的点击仍被抑制，松开后恢复", async () => {
		const { card } = setup();
		const onClick = vi.fn();
		card.addEventListener("click", onClick);

		card.dispatchEvent(pointer("pointerdown", { clientX: 0, clientY: 0 }));
		document.dispatchEvent(pointer("pointermove", { clientX: 30, clientY: 0 }));
		document.dispatchEvent(
			new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
		);
		await new Promise((resolve) => setTimeout(resolve, 0));

		// 键还没松开，宏任务已过：监听仍在
		document.dispatchEvent(pointer("pointerup", { clientX: 30, clientY: 0 }));
		card.click();
		expect(onClick).not.toHaveBeenCalled();

		await new Promise((resolve) => setTimeout(resolve, 0));
		card.click();
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("失焦取消后，下一次按下就解除抑制", async () => {
		const { card } = setup();
		const onClick = vi.fn();
		card.addEventListener("click", onClick);

		card.dispatchEvent(pointer("pointerdown", { clientX: 0, clientY: 0 }));
		document.dispatchEvent(pointer("pointermove", { clientX: 30, clientY: 0 }));
		window.dispatchEvent(new Event("blur"));
		card.dispatchEvent(pointer("pointerdown", { clientX: 0, clientY: 0 }));
		document.dispatchEvent(pointer("pointerup", { clientX: 0, clientY: 0 }));
		await new Promise((resolve) => setTimeout(resolve, 0));
		card.click();

		expect(onClick).toHaveBeenCalledTimes(1);
	});
});

describe("触屏", () => {
	beforeEach(() => vi.useFakeTimers());

	it("长按到时开始拖拽，不需要先移动", () => {
		const { card, calls } = setup();

		card.dispatchEvent(
			pointer("pointerdown", { pointerType: "touch", clientX: 20, clientY: 20 }),
		);
		vi.advanceTimersByTime(249);
		expect(calls).toEqual([]);
		vi.advanceTimersByTime(2);

		expect(calls).toEqual([
			["start", "a", { x: 20, y: 20 }],
			["move", { x: 20, y: 20 }],
		]);
	});

	it("长按未到时手指移动超过容差，视为滚动，不开始拖拽", () => {
		const { card, calls } = setup();

		card.dispatchEvent(
			pointer("pointerdown", { pointerType: "touch", clientX: 20, clientY: 20 }),
		);
		document.dispatchEvent(
			pointer("pointermove", { pointerType: "touch", clientX: 20, clientY: 40 }),
		);
		vi.advanceTimersByTime(1000);

		expect(calls).toEqual([]);
	});

	it("拖拽开始后阻止触摸滚动，拖拽之外不干预滚动", () => {
		const { card } = setup();
		const before = new Event("touchmove", { bubbles: true, cancelable: true });
		card.dispatchEvent(before);
		card.dispatchEvent(
			pointer("pointerdown", { pointerType: "touch", clientX: 20, clientY: 20 }),
		);
		vi.advanceTimersByTime(300);

		const during = new Event("touchmove", { bubbles: true, cancelable: true });
		card.dispatchEvent(during);

		expect(before.defaultPrevented).toBe(false);
		expect(during.defaultPrevented).toBe(true);
	});

	it("非被动的 touchmove 监听在挂载时就挂在看板根上：浏览器在触摸开始时据此决定手势能否被取消，且不影响看板之外的滚动", () => {
		const add = vi.spyOn(EventTarget.prototype, "addEventListener");

		const { root } = setup();

		const touchmoves = add.mock.calls
			.map((call, index) => ({ call, target: add.mock.contexts[index] }))
			.filter(({ call }) => call[0] === "touchmove");
		expect(touchmoves).toHaveLength(1);
		expect(touchmoves[0].target).toBe(root);
		expect(touchmoves[0].call[2]).toEqual({ passive: false });
		add.mockRestore();
	});

	it("长按期间抬起手指，计时取消，点击照常发生", () => {
		const { card, calls } = setup();
		const onClick = vi.fn();
		card.addEventListener("click", onClick);

		card.dispatchEvent(
			pointer("pointerdown", { pointerType: "touch", clientX: 20, clientY: 20 }),
		);
		document.dispatchEvent(
			pointer("pointerup", { pointerType: "touch", clientX: 20, clientY: 20 }),
		);
		vi.advanceTimersByTime(1000);
		card.click();

		expect(calls).toEqual([]);
		expect(onClick).toHaveBeenCalledTimes(1);
	});
});
