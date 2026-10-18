import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardMove } from "../core/index.ts";
import { EDITING_EVENT, PAN_EVENT, type PanRequest } from "../pan-region.ts";
import { Board } from "./board.tsx";
import { measureFlip, screenScale } from "./drag/dom.ts";
import type { DragController, DragHost } from "./drag/types.ts";

interface Task {
	id: string;
	title: string;
}

const tasks: Task[] = ["a", "b", "c", "d"].map((id) => ({ id, title: id.toUpperCase() }));
const columns = [
	{ id: "todo", title: "Todo" },
	{ id: "doing", title: "Doing" },
	{ id: "done", title: "Done" },
];
const order = { todo: ["a", "b", "c"], doing: ["d"], done: [] as string[] };

const rect = (left: number, top: number, width: number, height: number) =>
	({
		left,
		top,
		width,
		height,
		right: left + width,
		bottom: top + height,
		x: left,
		y: top,
		toJSON() {},
	}) as DOMRect;

/** 画布对内容的变换：屏幕坐标 = origin + scale * 布局坐标。 */
const view = { scale: 1, origin: { x: 0, y: 0 }, region: rect(0, 0, 0, 0) };
const toScreen = (left: number, top: number) => ({
	x: view.origin.x + view.scale * left,
	y: view.origin.y + view.scale * top,
});

/**
 * jsdom 没有布局：用「列横排、卡片竖排」的布局坐标（列宽 180、间距 20，卡片 160×50、间距 10），
 * 再按画布的缩放与平移换成屏幕坐标，和真实浏览器里 transform 的效果一致。
 */
function stubCanvasLayout() {
	const local = (element: Element) => {
		if (
			element.classList.contains("v-kanban") ||
			element.classList.contains("v-kanban__scroller")
		)
			return { left: 0, top: 0, width: 600, height: 700 };
		if (element.classList.contains("v-kanban__ghost")) {
			const style = (element as HTMLElement).style;
			const translate = /translate\(([-\d.e]+)px, ([-\d.e]+)px\)/.exec(style.transform);
			return {
				left: Number(translate?.[1] ?? 0),
				top: Number(translate?.[2] ?? 0),
				width: Number.parseFloat(style.width),
				height: Number.parseFloat(style.height),
			};
		}
		if (element.classList.contains("v-kanban__menu")) {
			const style = (element as HTMLElement).style;
			return {
				left: Number.parseFloat(style.left) || 0,
				top: Number.parseFloat(style.top) || 0,
				width: 120,
				height: 80,
			};
		}
		const column = element.closest("[data-column-id]") as HTMLElement | null;
		if (!column) return { left: 0, top: 0, width: 0, height: 0 };
		const index = [...(column.parentElement as HTMLElement).children].indexOf(column);
		if (element === column) return { left: index * 200, top: 0, width: 180, height: 600 };
		const item = element.closest("[data-card-id], [data-placeholder]") as HTMLElement | null;
		if (!item) return { left: index * 200, top: 0, width: 180, height: 0 };
		const list = item.parentElement as HTMLElement;
		const slot = [...list.children]
			.filter((child) => !child.hasAttribute("data-origin"))
			.indexOf(item);
		const cardBox = { left: index * 200 + 10, top: 50 + slot * 60, width: 160, height: 50 };
		if (element.classList.contains("v-kanban__move"))
			return { left: cardBox.left + 100, top: cardBox.top + 4, width: 56, height: 24 };
		return cardBox;
	};
	const rects = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
		this: Element,
	) {
		if (this.matches("[data-kanban-pan-region]")) return view.region;
		const box = local(this);
		const { x, y } = toScreen(box.left, box.top);
		return rect(x, y, view.scale * box.width, view.scale * box.height);
	});
	const widths = vi
		.spyOn(HTMLElement.prototype, "offsetWidth", "get")
		.mockImplementation(function (this: HTMLElement) {
			return local(this).width;
		});
	return () => {
		rects.mockRestore();
		widths.mockRestore();
	};
}

const init = { pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0 };
const card = (id: string) => document.querySelector(`[data-card-id="${id}"]`) as HTMLElement;
const ghost = () => document.querySelector(".v-kanban__ghost") as HTMLElement | null;
const screenCenter = (element: Element) => {
	const box = element.getBoundingClientRect();
	return { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
};
/** 布局坐标 (left, top) 在屏幕上的位置。 */
const colX = (index: number) => index * 200 + 90;
const slotY = (slot: number) => 50 + slot * 60 + 20;

function pickUp(id: string, to: { x: number; y: number }) {
	const from = screenCenter(card(id));
	fireEvent.pointerDown(card(id), { ...init, clientX: from.x, clientY: from.y });
	fireEvent.pointerMove(document, { ...init, clientX: from.x + 10, clientY: from.y });
	fireEvent.pointerMove(document, { ...init, clientX: to.x, clientY: to.y });
	return {
		from,
		release: () => fireEvent.pointerUp(document, { ...init, clientX: to.x, clientY: to.y }),
		moveTo: (point: { x: number; y: number }) =>
			fireEvent.pointerMove(document, { ...init, clientX: point.x, clientY: point.y }),
	};
}

function renderBoard(
	props: Partial<Parameters<typeof Board<Task, (typeof columns)[number]>>[0]> = {},
) {
	return render(
		<div data-testid="region" data-kanban-pan-region="">
			<Board
				columns={columns}
				cards={tasks}
				order={order}
				renderCard={(task) => <span>{task.title}</span>}
				onMove={() => {}}
				{...props}
			/>
		</div>,
	);
}

let restore: () => void;
beforeEach(() => {
	view.scale = 0.5;
	view.origin = { x: 100, y: 60 };
	view.region = rect(0, 0, 2000, 2000);
	restore = stubCanvasLayout();
});
afterEach(() => restore());

describe("缩放与平移下的拖拽", () => {
	it("落点按屏幕坐标求值：51% 缩放、画布已平移时仍落在指针下的列与位置", () => {
		view.scale = 0.51;
		const onMove = vi.fn<(move: BoardMove) => void>();
		renderBoard({ onMove });

		const drag = pickUp("a", toScreen(colX(1), slotY(1)));
		drag.release();

		expect(onMove).toHaveBeenCalledTimes(1);
		expect(onMove.mock.calls[0][0]).toMatchObject({
			cardId: "a",
			to: { columnId: "doing", index: 1 },
		});
	});

	it("浮起卡片尺寸换成布局像素：画布再按缩放显示，和卡片一样大", () => {
		renderBoard();

		pickUp("a", toScreen(colX(1), slotY(1)));

		expect(ghost()?.style.width).toBe("160px");
		expect(ghost()?.style.height).toBe("50px");
		expect((document.querySelector("[data-placeholder]") as HTMLElement).style.height).toBe(
			"50px",
		);
	});

	it("浮起卡片的左上角跟着指针走，保持抓取位置不跳变", () => {
		renderBoard();
		const start = card("a").getBoundingClientRect();
		const target = toScreen(colX(1), slotY(1));

		const drag = pickUp("a", target);

		// 抓取点相对卡片左上角的偏移（屏幕像素）
		const grab = { x: drag.from.x - start.left, y: drag.from.y - start.top };
		const expectedScreen = { x: target.x - grab.x, y: target.y - grab.y };
		const shown = (ghost() as HTMLElement).getBoundingClientRect();
		expect(shown.left).toBeCloseTo(expectedScreen.x, 6);
		expect(shown.top).toBeCloseTo(expectedScreen.y, 6);
	});

	it("画布在拖拽中平移：指针没动，浮起卡片仍留在指针下", () => {
		renderBoard();
		const target = toScreen(colX(1), slotY(1));
		const drag = pickUp("a", target);
		const before = (ghost() as HTMLElement).getBoundingClientRect();

		view.origin = { x: view.origin.x - 80, y: view.origin.y - 30 };
		drag.moveTo(target);

		const after = (ghost() as HTMLElement).getBoundingClientRect();
		expect(after.left).toBeCloseTo(before.left, 6);
		expect(after.top).toBeCloseTo(before.top, 6);
	});

	it("画布平移后落点跟着换列：指针不动，内容移到它下面的那一列才是落点", () => {
		const onMove = vi.fn<(move: BoardMove) => void>();
		renderBoard({ onMove });
		const target = toScreen(colX(1), slotY(1));
		const drag = pickUp("a", target);

		// 内容向左移 200 个布局像素：指针下面变成第三列
		view.origin = { x: view.origin.x - 200 * view.scale, y: view.origin.y };
		drag.moveTo(target);
		drag.release();

		expect(onMove.mock.calls[0][0]).toMatchObject({ to: { columnId: "done", index: 0 } });
	});

	it("开始拖拽时告知画布：用户在编辑，画布不再随内容尺寸自动适应", () => {
		renderBoard();
		const region = document.querySelector("[data-kanban-pan-region]") as HTMLElement;
		const notified = vi.fn();
		region.addEventListener(EDITING_EVENT, notified);

		const from = screenCenter(card("a"));
		fireEvent.pointerDown(card("a"), { ...init, clientX: from.x, clientY: from.y });
		expect(notified).not.toHaveBeenCalled();
		fireEvent.pointerMove(document, { ...init, clientX: from.x + 10, clientY: from.y });

		expect(notified).toHaveBeenCalledTimes(1);
	});

	it("指针离开画布视口就没有落点：放下后卡片留在原处", () => {
		const onMove = vi.fn();
		view.region = rect(0, 0, 300, 300);
		renderBoard({ onMove });
		// 第三列在视口之外（屏幕 x 约 560），但仍在内容的几何范围内
		const outside = toScreen(colX(2), slotY(0));
		expect(outside.x).toBeGreaterThan(300);

		pickUp("a", outside).release();

		expect(onMove).not.toHaveBeenCalled();
	});

	describe("落位动画", () => {
		const ghostFrames: Array<Array<{ transform: string }>> = [];
		beforeEach(() => {
			ghostFrames.length = 0;
			Object.defineProperty(Element.prototype, "animate", {
				configurable: true,
				value(this: Element, frames: Array<{ transform: string }>) {
					if (this.classList.contains("v-kanban__ghost")) ghostFrames.push(frames);
					return { finished: new Promise(() => {}), cancel() {} };
				},
			});
		});
		afterEach(() => void Reflect.deleteProperty(Element.prototype, "animate"));

		it("落位动画飞向卡片最终位置：位移换成布局像素", () => {
			renderBoard();

			pickUp("a", toScreen(colX(1), slotY(1))).release();

			const match = /translate\(([-\d.e]+)px, ([-\d.e]+)px\)/.exec(
				ghostFrames[0][1].transform,
			);
			// 卡片 a 落在 doing 列第 1 位，布局坐标 (210, 110)
			expect(Number(match?.[1])).toBeCloseTo(210, 6);
			expect(Number(match?.[2])).toBeCloseTo(110, 6);
		});

		it("落位动画还没播完又抓起另一张卡：新的浮起卡片立即放在指针下，不用等下一次移动", () => {
			renderBoard();
			pickUp("a", toScreen(colX(1), slotY(1))).release();
			const target = toScreen(colX(2), slotY(0));
			const from = screenCenter(card("b"));
			const start = card("b").getBoundingClientRect();

			// 只有一次移动：开始拖拽的那一下（触屏长按到时也没有后续移动）
			fireEvent.pointerDown(card("b"), { ...init, clientX: from.x, clientY: from.y });
			fireEvent.pointerMove(document, { ...init, clientX: target.x, clientY: target.y });

			const grab = { x: from.x - start.left, y: from.y - start.top };
			const shown = (ghost() as HTMLElement).getBoundingClientRect();
			expect(shown.left).toBeCloseTo(target.x - grab.x, 6);
			expect(shown.top).toBeCloseTo(target.y - grab.y, 6);
		});
	});
});

describe("缩放下的位置过渡与菜单", () => {
	it("screenScale 由屏幕宽度与布局宽度之比得到；没有布局宽度时按 1", () => {
		const element = document.createElement("div");
		vi.spyOn(element, "getBoundingClientRect").mockReturnValue(rect(0, 0, 300, 100));
		vi.spyOn(element, "offsetWidth", "get").mockReturnValue(600);

		expect(screenScale(element)).toBe(0.5);

		vi.spyOn(element, "offsetWidth", "get").mockReturnValue(0);
		expect(screenScale(element)).toBe(1);
	});

	it("measureFlip 的位置是布局像素：缩放与平移都不改变它", () => {
		renderBoard();
		const scroller = document.querySelector(".v-kanban__scroller") as HTMLElement;
		const at = () => measureFlip(scroller).get("card:b");

		const first = at();
		view.scale = 1.25;
		view.origin = { x: 500, y: -40 };
		const second = at();

		expect(second?.x).toBeCloseTo(first?.x ?? Number.NaN, 6);
		expect(second?.y).toBeCloseTo(first?.y ?? Number.NaN, 6);
		expect(first).toEqual({ x: 10, y: 110 });
	});

	it("「移到…」菜单贴着触发按钮：位置换成布局像素，缩放不让它错位", () => {
		renderBoard({ moveMenu: "always" });
		const trigger = card("a").querySelector(".v-kanban__move") as HTMLElement;

		fireEvent.click(trigger);

		const menu = document.querySelector(".v-kanban__menu") as HTMLElement;
		const shown = menu.getBoundingClientRect();
		const anchor = trigger.getBoundingClientRect();
		expect(shown.right).toBeCloseTo(anchor.right, 6);
		expect(shown.top).toBeCloseTo(anchor.bottom + 4, 6);
	});
});

describe("「移到…」菜单在画布里", () => {
	it("放不下时按画布视口翻到触发按钮上方，而不是按窗口", () => {
		view.region = rect(0, 0, 400, 120);
		renderBoard({ moveMenu: "always" });
		const trigger = card("a").querySelector(".v-kanban__move") as HTMLElement;
		const anchor = trigger.getBoundingClientRect();

		fireEvent.click(trigger);

		const shown = (
			document.querySelector(".v-kanban__menu") as HTMLElement
		).getBoundingClientRect();
		expect(shown.bottom).toBeLessThanOrEqual(anchor.top);
		expect(shown.top).toBeGreaterThanOrEqual(0);
	});

	it("靠近画布视口右缘时向左收，不伸出视口", () => {
		view.region = rect(0, 0, 150, 600);
		renderBoard({ moveMenu: "always" });
		const trigger = card("a").querySelector(".v-kanban__move") as HTMLElement;

		fireEvent.click(trigger);

		const shown = (
			document.querySelector(".v-kanban__menu") as HTMLElement
		).getBoundingClientRect();
		expect(shown.right).toBeLessThanOrEqual(150);
	});
});

describe("拖到视口边缘自动平移", () => {
	let requests: PanRequest[];
	const listen = () => {
		const region = document.querySelector("[data-kanban-pan-region]") as HTMLElement;
		region.addEventListener(PAN_EVENT, (event) =>
			requests.push((event as CustomEvent<PanRequest>).detail),
		);
	};
	const frames = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

	beforeEach(() => {
		requests = [];
		vi.useFakeTimers({
			toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
		});
		view.region = rect(0, 0, 800, 600);
	});
	afterEach(() => vi.useRealTimers());

	it("指针停在左边缘 48px 内：每帧请求画布向右平移", () => {
		renderBoard();
		listen();

		pickUp("a", { x: 10, y: 300 });
		frames(100);

		expect(requests.length).toBeGreaterThan(3);
		expect(requests.every((request) => request.dx > 0 && request.dy === 0)).toBe(true);
	});

	it("右边缘、上边缘、下边缘各朝对应方向；离边缘远不平移", () => {
		renderBoard();
		listen();
		const drag = pickUp("a", { x: 790, y: 300 });
		frames(50);
		expect(requests.at(-1)?.dx).toBeLessThan(0);

		requests.length = 0;
		drag.moveTo({ x: 400, y: 5 });
		frames(50);
		expect(requests.at(-1)).toMatchObject({ dx: 0 });
		expect(requests.at(-1)?.dy).toBeGreaterThan(0);

		requests.length = 0;
		drag.moveTo({ x: 400, y: 595 });
		frames(50);
		expect(requests.at(-1)?.dy).toBeLessThan(0);

		requests.length = 0;
		drag.moveTo({ x: 400, y: 300 });
		frames(100);
		expect(requests).toEqual([]);
	});

	it("速度按时间而不是帧数：同样 100ms，请求的距离之和相同", () => {
		renderBoard();
		listen();

		pickUp("a", { x: 0, y: 300 });
		frames(160);

		const total = requests.reduce((sum, request) => sum + request.dx, 0);
		// 贴边最大速度 1000px/s，约 160ms
		expect(total).toBeGreaterThan(120);
		expect(total).toBeLessThanOrEqual(1000 * 0.18);
	});

	it("画布动不了（已到内容尽头）的帧不重新量位置，动了才量", () => {
		renderBoard();
		const region = document.querySelector("[data-kanban-pan-region]") as HTMLElement;
		let honour = false;
		region.addEventListener(PAN_EVENT, (event) => {
			if (honour) event.preventDefault();
		});
		const columnReads = () =>
			vi
				.mocked(Element.prototype.getBoundingClientRect)
				.mock.contexts.filter((element) =>
					(element as Element).hasAttribute("data-column-id"),
				).length;
		pickUp("a", { x: 10, y: 300 });

		const before = columnReads();
		frames(160);
		expect(columnReads()).toBe(before);

		honour = true;
		frames(160);
		expect(columnReads()).toBeGreaterThan(before);
	});

	it("第一帧的时间戳早于开始拖拽时读到的时间：不会朝反方向平移", () => {
		renderBoard();
		listen();
		// 拖拽是在某次事件里开始的，读到的时间可能比下一帧的帧起始时间还晚
		const now = vi.spyOn(performance, "now").mockReturnValue(500);

		pickUp("a", { x: 10, y: 300 });
		now.mockRestore();
		frames(100);

		expect(requests.length).toBeGreaterThan(0);
		expect(requests.every((request) => request.dx >= 0)).toBe(true);
	});

	describe("结束后停止", () => {
		// 落位动画还没播完：卡片仍在 settling 阶段，指针也还停在边缘
		beforeEach(() => {
			Object.defineProperty(Element.prototype, "animate", {
				configurable: true,
				value: () => ({ finished: new Promise(() => {}), cancel() {} }),
			});
		});
		afterEach(() => void Reflect.deleteProperty(Element.prototype, "animate"));

		const startPanning = () => {
			const drag = pickUp("a", { x: 10, y: 300 });
			frames(50);
			expect(requests.length).toBeGreaterThan(0);
			requests.length = 0;
			return drag;
		};

		it("放下后停止，落位动画期间也不再平移", () => {
			renderBoard();
			listen();

			startPanning().release();
			frames(200);

			expect(requests).toEqual([]);
		});

		it("Esc 取消后停止", () => {
			renderBoard();
			listen();

			startPanning();
			fireEvent.keyDown(document, { key: "Escape" });
			frames(200);

			expect(requests).toEqual([]);
		});

		it("自定义控制器的清理没有取消拖拽：卸载也停止自动平移", () => {
			let host: DragHost | undefined;
			const controller: DragController = {
				attach(attached) {
					host = attached;
					return () => {};
				},
			};
			const mounted = renderBoard({ dragController: controller });
			listen();

			act(() => {
				host?.start("a", { x: 10, y: 300 });
				host?.move({ x: 10, y: 300 });
			});
			frames(50);
			expect(requests.length).toBeGreaterThan(0);
			mounted.unmount();
			requests.length = 0;
			frames(200);

			expect(requests).toEqual([]);
		});

		it("卸载后停止", () => {
			const mounted = renderBoard();
			listen();

			startPanning();
			mounted.unmount();
			frames(200);

			expect(requests).toEqual([]);
		});
	});

	it("平移之后立刻按新布局重新求落点：指针停在边缘，内容滑过去，占位跟着换列", () => {
		// 内容一开始整个在视口左边之外，自动平移把它推向停在左边缘的指针
		view.origin = { x: -400, y: 60 };
		renderBoard();
		pickUp("a", { x: 10, y: 300 });
		const region = document.querySelector("[data-kanban-pan-region]") as HTMLElement;
		region.addEventListener(PAN_EVENT, (event) => {
			const { dx } = (event as CustomEvent<PanRequest>).detail;
			view.origin = { x: view.origin.x + dx, y: view.origin.y };
			event.preventDefault();
		});
		const placeholderColumn = () =>
			document
				.querySelector("[data-placeholder]")
				?.closest("[data-column-id]")
				?.getAttribute("data-column-id");
		const seen = new Set<string | null | undefined>([placeholderColumn()]);

		for (let step = 0; step < 40; step += 1) {
			frames(16);
			seen.add(placeholderColumn());
		}

		expect(seen).toContain("doing");
	});

	it("没有画布（看板不在可平移区域里）时不做任何平移", () => {
		render(
			<Board
				columns={columns}
				cards={tasks}
				order={order}
				renderCard={(task) => <span>{task.title}</span>}
				onMove={() => {}}
			/>,
		);
		const events: Event[] = [];
		const abort = new AbortController();
		document.addEventListener(PAN_EVENT, (event) => events.push(event), {
			signal: abort.signal,
		});

		pickUp("a", { x: 10, y: 300 });
		frames(200);
		abort.abort();

		expect(events).toEqual([]);
	});
});
