import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardMove } from "../core/index.ts";
import { Board, type BoardProps } from "./board.tsx";

interface Task {
	id: string;
	title: string;
}

const tasks: Task[] = ["a", "b", "c", "d"].map((id) => ({ id, title: id.toUpperCase() }));
const columns = [
	{ id: "todo", title: "规划中" },
	{ id: "doing", title: "开发中" },
	{ id: "done", title: "已完成", autoSort: "start" as const },
];
const order = { todo: ["a", "b", "c"], doing: ["d"], done: [] as string[] };

/** jsdom 没有布局：按「列横排、卡片竖排」给出确定的几何，每列宽 180、间距 20，卡片高 50、间距 10。 */
function stubLayout() {
	return vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
		this: Element,
	) {
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
		const column = this.closest("[data-column-id]") as HTMLElement | null;
		if (!column) return rect(0, 0, 0, 0);
		const root = column.parentElement as HTMLElement;
		const columnIndex = [...root.querySelectorAll(":scope > [data-column-id]")].indexOf(column);
		if (this === column) return rect(columnIndex * 200, 0, 180, 600);
		const list = this.parentElement as HTMLElement;
		const slot = [...list.children]
			.filter((child) => !child.hasAttribute("data-origin"))
			.indexOf(this);
		return rect(columnIndex * 200 + 10, 50 + slot * 60, 160, 50);
	});
}

const center = (element: Element) => {
	const rect = element.getBoundingClientRect();
	return { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 };
};
const init = { pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0 };
const card = (id: string) => document.querySelector(`[data-card-id="${id}"]`) as HTMLElement;
const cardIds = (columnName: string) =>
	within(screen.getByRole("group", { name: columnName }))
		.queryAllByRole("listitem")
		.filter((item) => !item.hasAttribute("data-origin"))
		.map((item) => item.getAttribute("data-card-id"));

const notice = () => document.querySelector(".v-kanban__notice")?.textContent;

/** 按下卡片、移出阈值、再移到目标点；返回松开与取消的操作。 */
function pickUp(id: string, to: { x: number; y: number }) {
	const from = center(card(id));
	fireEvent.pointerDown(card(id), { ...init, clientX: from.x, clientY: from.y });
	fireEvent.pointerMove(document, { ...init, clientX: from.x + 10, clientY: from.y });
	fireEvent.pointerMove(document, { ...init, clientX: to.x, clientY: to.y });
	act(() => vi.advanceTimersToNextFrame());
	return {
		release: () => fireEvent.pointerUp(document, { ...init, clientX: to.x, clientY: to.y }),
	};
}

/** 列内第 slot 个位置的纵坐标：卡片中线上方 5px，即落在该位置的上半部分。 */
const slotY = (slot: number) => 50 + slot * 60 + 20;
const colX = (index: number) => index * 200 + 90;

type Props = Partial<BoardProps<Task, (typeof columns)[number]>>;
function renderBoard(props: Props = {}) {
	return render(
		<Board
			columns={columns}
			cards={tasks}
			order={order}
			renderCard={(task) => <span>{task.title}</span>}
			onMove={() => {}}
			{...props}
		/>,
	);
}

let layout: ReturnType<typeof stubLayout>;
beforeEach(() => {
	vi.useFakeTimers({
		toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
	});
	layout = stubLayout();
});
afterEach(() => {
	layout.mockRestore();
	vi.useRealTimers();
});

describe("拖拽移动", () => {
	it("跨列拖动：拖拽中显示占位与跟随指针的浮起卡片，松开后以移动事件提交", () => {
		const onMove = vi.fn();
		renderBoard({ onMove });

		pickUp("a", { x: colX(1), y: slotY(1) });

		expect(document.querySelector("[data-placeholder]")).not.toBeNull();
		expect(document.querySelector(".v-kanban__ghost")?.textContent).toBe("A");
		expect(card("a").getAttribute("data-origin")).toBe("true");
		expect(cardIds("规划中")).toEqual(["b", "c"]);
		expect(onMove).not.toHaveBeenCalled();
	});

	it("拖拽期间被按下的卡片节点保持在文档中且不被移动：触屏的后续事件仍发给它，才能被拦截", () => {
		renderBoard();
		const original = card("a");

		pickUp("a", { x: colX(1), y: slotY(1) });
		fireEvent.pointerMove(document, { ...init, clientX: colX(1), clientY: slotY(0) });
		fireEvent.pointerMove(document, { ...init, clientX: colX(0), clientY: slotY(2) });
		fireEvent.pointerMove(document, { ...init, clientX: colX(0), clientY: slotY(0) });

		expect(original.isConnected).toBe(true);
		expect(card("a")).toBe(original);
		expect(original.parentElement?.children[0]).toBe(original);
	});

	it("松开后提交：移动事件带来源、目标位置与相邻卡片，界面立即按新顺序显示", () => {
		const onMove = vi.fn<(move: BoardMove) => void>();
		renderBoard({ onMove });

		pickUp("a", { x: colX(1), y: slotY(1) }).release();

		expect(onMove).toHaveBeenCalledTimes(1);
		expect(onMove.mock.calls[0][0]).toEqual({
			cardId: "a",
			from: { columnId: "todo", index: 0 },
			to: { columnId: "doing", index: 1 },
			previousId: "d",
			nextId: null,
			fromPreviousId: null,
			fromNextId: "b",
		});
		expect(cardIds("规划中")).toEqual(["b", "c"]);
		expect(cardIds("开发中")).toEqual(["d", "a"]);
		expect(document.querySelector(".v-kanban__ghost")).toBeNull();
	});

	it("同列重排", () => {
		const onMove = vi.fn<(move: BoardMove) => void>();
		renderBoard({ onMove });

		pickUp("a", { x: colX(0), y: slotY(3) }).release();

		expect(onMove.mock.calls[0][0]).toMatchObject({
			to: { columnId: "todo", index: 2 },
			previousId: "c",
			nextId: null,
		});
		expect(cardIds("规划中")).toEqual(["b", "c", "a"]);
	});

	it("放回原位不触发移动", () => {
		const onMove = vi.fn();
		renderBoard({ onMove });

		pickUp("b", { x: colX(0), y: slotY(1) }).release();

		expect(onMove).not.toHaveBeenCalled();
		expect(cardIds("规划中")).toEqual(["a", "b", "c"]);
	});

	it("拖出看板后松开，不触发移动，卡片留在原处", () => {
		const onMove = vi.fn();
		renderBoard({ onMove });

		pickUp("a", { x: 900, y: 300 }).release();

		expect(onMove).not.toHaveBeenCalled();
		expect(cardIds("规划中")).toEqual(["a", "b", "c"]);
	});

	it("按 Esc 取消拖拽", () => {
		const onMove = vi.fn();
		renderBoard({ onMove });

		pickUp("a", { x: colX(1), y: slotY(1) });
		fireEvent.keyDown(document, { key: "Escape" });

		expect(onMove).not.toHaveBeenCalled();
		expect(document.querySelector(".v-kanban__ghost")).toBeNull();
		expect(cardIds("规划中")).toEqual(["a", "b", "c"]);
	});

	it("拖拽结束后随之而来的点击被抑制", () => {
		const onClick = vi.fn();
		renderBoard({
			renderCard: (task) => (
				<button type="button" onClick={onClick}>
					{task.title}
				</button>
			),
		});

		pickUp("a", { x: colX(1), y: slotY(1) }).release();
		fireEvent.click(screen.getByRole("button", { name: "A" }));

		expect(onClick).not.toHaveBeenCalled();
	});
});

describe("折叠的列", () => {
	it("折叠的列不是落点：拖到它上面放下没有移动，卡片留在原处", () => {
		const onMove = vi.fn();
		renderBoard({ onMove, collapsible: true, defaultCollapsedColumns: ["doing"] });

		pickUp("a", { x: colX(1), y: slotY(1) }).release();

		expect(onMove).not.toHaveBeenCalled();
		expect(cardIds("规划中")).toEqual(["a", "b", "c"]);
	});

	it("展开的邻列照常接收", () => {
		const onMove = vi.fn();
		renderBoard({ onMove, collapsible: true, defaultCollapsedColumns: ["doing"] });

		pickUp("a", { x: colX(2), y: slotY(0) }).release();

		expect(onMove).toHaveBeenCalledTimes(1);
	});
});

describe("可编辑与只读", () => {
	it("没有 onMove 时看板只读：卡片没有拖拽标记，按下后移动也不会拖起", () => {
		renderBoard({ onMove: undefined });

		pickUp("a", { x: colX(1), y: slotY(1) });

		expect(document.querySelector("[data-draggable]")).toBeNull();
		expect(document.querySelector("[data-placeholder]")).toBeNull();
		expect(document.querySelector(".v-kanban__ghost")).toBeNull();
	});

	it("readOnly 优先于 onMove", () => {
		renderBoard({ readOnly: true });

		pickUp("a", { x: colX(1), y: slotY(1) });

		expect(document.querySelector("[data-placeholder]")).toBeNull();
	});

	it("isDraggable 可按卡片禁用拖动", () => {
		const onMove = vi.fn();
		renderBoard({ onMove, isDraggable: (task) => task.id !== "a" });

		pickUp("a", { x: colX(1), y: slotY(1) }).release();
		expect(onMove).not.toHaveBeenCalled();
		expect(card("a").hasAttribute("data-draggable")).toBe(false);

		pickUp("b", { x: colX(1), y: slotY(1) }).release();
		expect(onMove).toHaveBeenCalledTimes(1);
	});
});

describe("canMove 与自动排序列", () => {
	it("canMove 拒绝：不触发移动，卡片回到原位，并显示拒绝原因", () => {
		const onMove = vi.fn();
		const canMove = vi.fn(() => ({
			allowed: false as const,
			reason: "被阻塞的条目不能进入开发中",
		}));
		renderBoard({ onMove, canMove });

		pickUp("a", { x: colX(1), y: slotY(1) }).release();

		expect(canMove).toHaveBeenCalled();
		expect(onMove).not.toHaveBeenCalled();
		expect(cardIds("规划中")).toEqual(["a", "b", "c"]);
		expect(notice()).toBe("被阻塞的条目不能进入开发中");
	});

	it("拖拽中落在被拒绝的位置时，占位标记为不可放置", () => {
		renderBoard({ canMove: () => ({ allowed: false }) });

		pickUp("a", { x: colX(1), y: slotY(1) });

		expect(document.querySelector("[data-placeholder]")?.getAttribute("data-invalid")).toBe(
			"true",
		);
	});

	it("canMove 拒绝但没有给原因时用内置提示", () => {
		renderBoard({ canMove: () => ({ allowed: false }) });

		pickUp("a", { x: colX(1), y: slotY(1) }).release();

		expect(notice()).toBe("This card can't be moved here.");
	});

	it("canMove 允许时放行，并收到完整的移动", () => {
		const canMove = vi.fn<(move: BoardMove) => { allowed: true }>(() => ({ allowed: true }));
		const onMove = vi.fn();
		renderBoard({ canMove, onMove });

		pickUp("a", { x: colX(1), y: slotY(1) }).release();

		expect(canMove.mock.calls.at(-1)?.[0]).toMatchObject({
			cardId: "a",
			to: { columnId: "doing" },
		});
		expect(onMove).toHaveBeenCalledTimes(1);
	});

	it("进入自动排序列：落在入口一端，与指针高度无关", () => {
		const onMove = vi.fn<(move: BoardMove) => void>();
		renderBoard({
			onMove,
			order: { ...order, done: ["x"] },
			cards: [...tasks, { id: "x", title: "X" }],
		});

		pickUp("a", { x: colX(2), y: slotY(5) }).release();

		expect(onMove.mock.calls[0][0]).toMatchObject({
			to: { columnId: "done", index: 0 },
			nextId: "x",
		});
	});

	it("自动排序列内手动重排被拒绝，并给出内置原因（随 locale 本地化）", () => {
		const onMove = vi.fn();
		renderBoard({
			onMove,
			locale: "zh-CN",
			order: { todo: [], doing: [], done: ["x", "y"] },
			cards: [
				{ id: "x", title: "X" },
				{ id: "y", title: "Y" },
			],
		});

		pickUp("y", { x: colX(2), y: slotY(0) }).release();

		expect(onMove).not.toHaveBeenCalled();
		expect(cardIds("已完成")).toEqual(["x", "y"]);
		expect(notice()).toBe("该列自动排序，不能手动调整顺序");
	});
});

describe("乐观更新与回滚", () => {
	it("onMove 返回的 Promise 被拒绝：卡片回到原位，触发错误回调并提示", async () => {
		const error = new Error("network");
		const onMoveError = vi.fn();
		renderBoard({ onMove: () => Promise.reject(error), onMoveError });

		await act(async () => {
			pickUp("a", { x: colX(1), y: slotY(1) }).release();
		});

		expect(onMoveError).toHaveBeenCalledWith(error, expect.objectContaining({ cardId: "a" }));
		expect(cardIds("规划中")).toEqual(["a", "b", "c"]);
		expect(cardIds("开发中")).toEqual(["d"]);
		expect(notice()).toBe("The move couldn't be saved. The card is back where it was.");
	});

	it("onMove 同步抛错与 Promise 拒绝一样回滚", async () => {
		const onMoveError = vi.fn();
		renderBoard({
			onMove: () => {
				throw new Error("sync");
			},
			onMoveError,
		});

		await act(async () => {
			pickUp("a", { x: colX(1), y: slotY(1) }).release();
		});

		expect(onMoveError).toHaveBeenCalledTimes(1);
		expect(cardIds("规划中")).toEqual(["a", "b", "c"]);
	});

	it("等待持久化期间保持乐观顺序；使用方更新 order 后以使用方为准", async () => {
		let resolve: () => void = () => {};
		const pending = new Promise<void>((done) => {
			resolve = done;
		});
		const view = renderBoard({ onMove: () => pending });

		pickUp("a", { x: colX(1), y: slotY(1) }).release();
		expect(cardIds("开发中")).toEqual(["d", "a"]);

		// 使用方无关的重渲染不应让卡片弹回
		view.rerender(
			<Board
				columns={columns}
				cards={tasks}
				order={{ ...order }}
				renderCard={(task) => <span>{task.title}</span>}
				onMove={() => pending}
			/>,
		);
		expect(cardIds("开发中")).toEqual(["d", "a"]);

		// 服务端把它排在最前
		view.rerender(
			<Board
				columns={columns}
				cards={tasks}
				order={{ todo: ["b", "c"], doing: ["a", "d"], done: [] }}
				renderCard={(task) => <span>{task.title}</span>}
				onMove={() => pending}
			/>,
		);
		await act(async () => resolve());

		expect(cardIds("开发中")).toEqual(["a", "d"]);
	});

	it("提示一段时间后自动消失", () => {
		vi.useFakeTimers();
		try {
			renderBoard({ canMove: () => ({ allowed: false, reason: "不行" }) });
			pickUp("a", { x: colX(1), y: slotY(1) }).release();
			expect(notice()).toBe("不行");

			act(() => vi.advanceTimersByTime(5000));

			expect(notice()).toBe("");
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("等待持久化期间的显示", () => {
	/** 两次移动都在途中：先 A→开发中，再 B→开发中。 */
	function twoPendingMoves() {
		const settle: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];
		const onMove = vi.fn(
			() =>
				new Promise<void>((resolve, reject) => {
					settle.push({ resolve, reject });
				}),
		);
		const view = renderBoard({ onMove });
		pickUp("a", { x: colX(1), y: slotY(1) }).release();
		pickUp("b", { x: colX(1), y: slotY(2) }).release();
		return { settle, view };
	}

	it("连续两次移动都在途中时，各自保持乐观位置", () => {
		twoPendingMoves();

		expect(cardIds("规划中")).toEqual(["c"]);
		expect(cardIds("开发中")).toEqual(["d", "a", "b"]);
	});

	it("先发起的移动成功并已体现在 order 里：后发起、仍在途中的移动不弹回", async () => {
		const { settle, view } = twoPendingMoves();

		view.rerender(
			<Board
				columns={columns}
				cards={tasks}
				order={{ todo: ["b", "c"], doing: ["d", "a"], done: [] }}
				renderCard={(task) => <span>{task.title}</span>}
				onMove={() => new Promise<void>(() => {})}
			/>,
		);
		await act(async () => settle[0].resolve());

		expect(cardIds("开发中")).toEqual(["d", "a", "b"]);
		expect(cardIds("规划中")).toEqual(["c"]);
	});

	it("先发起的移动失败：它回滚，后发起的仍在途中的移动保持", async () => {
		const { settle } = twoPendingMoves();

		await act(async () => settle[0].reject(new Error("no")));

		expect(cardIds("开发中")).toEqual(["d", "b"]);
		expect(cardIds("规划中")).toEqual(["a", "c"]);
	});

	it("onMove 成功完成但 order 没有变化：完成后只认 order，卡片回到原位", async () => {
		const view = renderBoard({ onMove: () => Promise.resolve() });

		await act(async () => {
			pickUp("a", { x: colX(1), y: slotY(1) }).release();
		});

		expect(view.container.querySelector("[data-origin]")).toBeNull();
		expect(cardIds("规划中")).toEqual(["a", "b", "c"]);
		expect(cardIds("开发中")).toEqual(["d"]);
	});
});

describe("放下时重新判定", () => {
	it("放下时按当前布局重新求值：拖拽途中 order 变了，移动不会带着过期的位置", () => {
		const onMove = vi.fn<(move: BoardMove) => void>();
		const view = renderBoard({ onMove });
		pickUp("a", { x: colX(1), y: slotY(1) });
		expect(document.querySelector("[data-placeholder]")).not.toBeNull();

		// 开发中的卡片被别处拿走了：同一个指针位置现在只能落在列首
		view.rerender(
			<Board
				columns={columns}
				cards={tasks}
				order={{ todo: ["a", "b", "c", "d"], doing: [], done: [] }}
				renderCard={(task) => <span>{task.title}</span>}
				onMove={onMove}
			/>,
		);
		fireEvent.pointerUp(document, { ...init, clientX: colX(1), clientY: slotY(1) });

		expect(onMove.mock.calls[0][0]).toMatchObject({
			to: { columnId: "doing", index: 0 },
			previousId: null,
			nextId: null,
		});
	});

	it("canMove 在落点变化时调用，同一落点内的移动不重复调用，放下时用最终的移动再判定一次", () => {
		const canMove = vi.fn<(move: BoardMove) => { allowed: true }>(() => ({ allowed: true }));
		const onMove = vi.fn<(move: BoardMove) => void>();
		renderBoard({ canMove, onMove });
		const from = center(card("a"));
		fireEvent.pointerDown(card("a"), { ...init, clientX: from.x, clientY: from.y });
		fireEvent.pointerMove(document, { ...init, clientX: from.x + 10, clientY: from.y });
		fireEvent.pointerMove(document, { ...init, clientX: colX(1), clientY: slotY(1) });
		act(() => vi.advanceTimersToNextFrame());
		const afterEnter = canMove.mock.calls.length;

		fireEvent.pointerMove(document, { ...init, clientX: colX(1) + 3, clientY: slotY(1) + 2 });
		fireEvent.pointerMove(document, { ...init, clientX: colX(1) + 5, clientY: slotY(1) + 3 });
		act(() => vi.advanceTimersToNextFrame());
		expect(canMove.mock.calls.length).toBe(afterEnter);

		fireEvent.pointerUp(document, { ...init, clientX: colX(1) + 5, clientY: slotY(1) + 3 });
		expect(canMove.mock.calls.length).toBe(afterEnter + 1);
		expect(canMove.mock.calls.at(-1)?.[0]).toEqual(onMove.mock.calls[0][0]);
	});

	it("canMove 抛错按拒绝处理，不中断拖拽", () => {
		const onMove = vi.fn();
		renderBoard({
			onMove,
			canMove: () => {
				throw new Error("rule bug");
			},
		});

		pickUp("a", { x: colX(1), y: slotY(1) }).release();

		expect(onMove).not.toHaveBeenCalled();
		expect(notice()).toBe("This card can't be moved here.");
		expect(cardIds("规划中")).toEqual(["a", "b", "c"]);
	});
});

describe("拖拽的起点与取消", () => {
	it("从表单控件或标记了 data-kanban-no-drag 的元素上按下，不起拖", () => {
		renderBoard({
			renderCard: (task) => (
				<div>
					<input aria-label={`title-${task.id}`} />
					<span data-kanban-no-drag>{task.title}</span>
					<em>{task.id}</em>
				</div>
			),
		});
		const fieldTarget = screen.getByLabelText("title-a");
		const markedTarget = within(card("a")).getByText("A");
		for (const target of [fieldTarget, markedTarget]) {
			const from = center(card("a"));
			fireEvent.pointerDown(target, { ...init, clientX: from.x, clientY: from.y });
			fireEvent.pointerMove(document, { ...init, clientX: from.x + 20, clientY: from.y });
			expect(document.querySelector("[data-placeholder]")).toBeNull();
			fireEvent.pointerUp(document, { ...init, clientX: from.x + 20, clientY: from.y });
		}

		const plain = within(card("a")).getByText("a");
		const from = center(card("a"));
		fireEvent.pointerDown(plain, { ...init, clientX: from.x, clientY: from.y });
		fireEvent.pointerMove(document, { ...init, clientX: from.x + 20, clientY: from.y });
		expect(document.querySelector("[data-placeholder]")).not.toBeNull();
	});

	it("Esc 取消时鼠标键还按着：松开后补发的点击仍被抑制", () => {
		const onClick = vi.fn();
		renderBoard({
			renderCard: (task) => (
				<button type="button" onClick={onClick}>
					{task.title}
				</button>
			),
		});
		const from = center(card("a"));

		pickUp("a", { x: colX(1), y: slotY(1) });
		fireEvent.keyDown(document, { key: "Escape" });
		fireEvent.pointerUp(document, { ...init, clientX: from.x, clientY: from.y });
		fireEvent.click(screen.getByRole("button", { name: "A" }));

		expect(onClick).not.toHaveBeenCalled();
	});

	it("浮起卡片不可聚焦也不可交互", () => {
		renderBoard({ renderCard: (task) => <button type="button">{task.title}</button> });

		pickUp("a", { x: colX(1), y: slotY(1) });

		const ghost = document.querySelector(".v-kanban__ghost") as HTMLElement;
		expect(ghost.hasAttribute("inert")).toBe(true);
		expect(ghost.getAttribute("aria-hidden")).toBe("true");
	});

	it("唯一的卡片被拖走时，原列显示空状态；id 恰好叫 placeholder 的卡片也能正常拖动", () => {
		const onMove = vi.fn<(move: BoardMove) => void>();
		renderBoard({
			onMove,
			cards: [{ id: "placeholder", title: "P" }],
			order: { todo: ["placeholder"], doing: [], done: [] },
		});

		pickUp("placeholder", { x: colX(1), y: slotY(0) });
		const todo = screen.getByRole("group", { name: "规划中" });
		expect(within(todo).getByText("No cards")).toBeTruthy();
		fireEvent.pointerUp(document, { ...init, clientX: colX(1), clientY: slotY(0) });

		expect(onMove.mock.calls[0][0]).toMatchObject({
			cardId: "placeholder",
			to: { columnId: "doing" },
		});
	});
});
