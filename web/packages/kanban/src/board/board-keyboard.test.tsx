import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BoardMove } from "../core/index.ts";
import { Board, type BoardProps } from "./board.tsx";

interface Task {
	id: string;
	title: string;
}

const tasks: Task[] = ["a", "b", "c", "d"].map((id) => ({ id, title: `Task ${id.toUpperCase()}` }));
const columns = [
	{ id: "todo", title: "Planned" },
	{ id: "doing", title: "In progress" },
	{ id: "done", title: "Done", autoSort: "start" as const },
];
const order = { todo: ["a", "b", "c"], doing: ["d"], done: [] as string[] };
const withXY = [...tasks, { id: "x", title: "Task X" }, { id: "y", title: "Task Y" }];

type Props = Partial<BoardProps<Task, (typeof columns)[number]>>;
function renderBoard(props: Props = {}) {
	return render(
		<Board
			columns={columns}
			cards={tasks}
			order={order}
			renderCard={(task) => <span>{task.title}</span>}
			getCardLabel={(task) => task.title}
			onMove={() => {}}
			{...props}
		/>,
	);
}

const card = (id: string) => document.querySelector(`[data-card-id="${id}"]`) as HTMLElement;
const announced = () => document.querySelector(".v-kanban__announcer")?.textContent;
const ids = (columnName: string) =>
	within(screen.getByRole("group", { name: columnName }))
		.queryAllByRole("listitem")
		.map((item) => item.getAttribute("data-card-id"));
/** 按键发给当前焦点所在的元素。 */
const press = (key: string, target: Element = document.activeElement ?? document.body) =>
	fireEvent.keyDown(target, { key });
const pickUp = (id: string) => {
	card(id).focus();
	press(" ", card(id));
};

afterEach(() => vi.useRealTimers());

describe("可聚焦与说明", () => {
	it("可编辑看板的卡片可用 Tab 聚焦，并关联键盘操作说明", () => {
		renderBoard();

		const a = card("a");
		expect(a.getAttribute("tabindex")).toBe("0");
		const hint = document.getElementById(a.getAttribute("aria-describedby") ?? "");
		expect(hint?.textContent).toBe(
			"Press Space or Enter to pick up this card. Then use the arrow keys to move it, Space or Enter to drop it, and Escape to cancel.",
		);
	});

	it("只读看板与被禁用的卡片不可聚焦", () => {
		renderBoard({ onMove: undefined });
		expect(document.querySelector("[tabindex]")).toBeNull();
		document.body.innerHTML = "";

		renderBoard({ isDraggable: (task) => task.id !== "a" });
		expect(card("a").hasAttribute("tabindex")).toBe(false);
		expect(card("b").getAttribute("tabindex")).toBe("0");
	});
});

describe("拿起、移动、放下", () => {
	it("空格拿起并播报当前位置与操作方法", () => {
		renderBoard();

		pickUp("b");

		expect(card("b").getAttribute("data-lifted")).toBe("true");
		expect(announced()).toBe(
			"Picked up Task B. Planned, position 2 of 3. Use the arrow keys to move it, Space or Enter to drop it, Escape to cancel.",
		);
	});

	it("Enter 同样可以拿起与放下", () => {
		const onMove = vi.fn();
		renderBoard({ onMove });

		card("a").focus();
		press("Enter", card("a"));
		press("ArrowDown");
		press("Enter");

		expect(card("a").hasAttribute("data-lifted")).toBe(false);
		expect(onMove).toHaveBeenCalledTimes(1);
	});

	it("上下方向键在列内移动，播报新位置，放下前不提交", () => {
		const onMove = vi.fn();
		renderBoard({ onMove });

		pickUp("a");
		press("ArrowDown");

		expect(ids("Planned")).toEqual(["b", "a", "c"]);
		expect(announced()).toBe("Planned, position 2 of 3.");
		expect(onMove).not.toHaveBeenCalled();
	});

	it("左右方向键换列，保持纵向序号并播报新列", () => {
		renderBoard();

		pickUp("c");
		press("ArrowRight");

		expect(ids("Planned")).toEqual(["a", "b"]);
		expect(ids("In progress")).toEqual(["d", "c"]);
		expect(announced()).toBe("In progress, position 2 of 2.");
	});

	it("焦点始终留在被移动的卡片上，包括它跨列重新挂载之后", () => {
		renderBoard();

		pickUp("a");
		press("ArrowRight");
		press("ArrowDown");

		expect(document.activeElement).toBe(card("a"));
	});

	it("空格放下：提交一次移动，并播报结果", () => {
		const onMove = vi.fn<(move: BoardMove) => void>();
		renderBoard({ onMove });

		pickUp("a");
		press("ArrowRight");
		press(" ");

		expect(onMove).toHaveBeenCalledTimes(1);
		expect(onMove.mock.calls[0][0]).toEqual({
			cardId: "a",
			from: { columnId: "todo", index: 0 },
			to: { columnId: "doing", index: 0 },
			previousId: null,
			nextId: "d",
		});
		expect(announced()).toBe("Dropped Task A. In progress, position 1 of 2.");
		expect(card("a").hasAttribute("data-lifted")).toBe(false);
		expect(document.activeElement).toBe(card("a"));
	});

	it("放回原位不触发移动", () => {
		const onMove = vi.fn();
		renderBoard({ onMove });

		pickUp("b");
		press("ArrowDown");
		press("ArrowUp");
		press(" ");

		expect(onMove).not.toHaveBeenCalled();
		expect(ids("Planned")).toEqual(["a", "b", "c"]);
	});

	it("Esc 取消：恢复原位、不提交、播报", () => {
		const onMove = vi.fn();
		renderBoard({ onMove });

		pickUp("a");
		press("ArrowRight");
		press("Escape");

		expect(onMove).not.toHaveBeenCalled();
		expect(ids("Planned")).toEqual(["a", "b", "c"]);
		expect(announced()).toBe("Move cancelled. Task A is back in Planned, position 1 of 3.");
		expect(document.activeElement).toBe(card("a"));
	});

	it("到达边缘不能再移动时播报，位置不变", () => {
		renderBoard();

		pickUp("a");
		press("ArrowUp");
		expect(announced()).toBe("Can't move further. Planned, position 1 of 3.");

		press("ArrowLeft");
		expect(announced()).toBe("Can't move further. Planned, position 1 of 3.");
		expect(ids("Planned")).toEqual(["a", "b", "c"]);
	});

	it("焦点离开看板即取消拿起", () => {
		vi.useFakeTimers();
		const onMove = vi.fn();
		renderBoard({ onMove });
		const outside = document.createElement("button");
		document.body.append(outside);

		pickUp("a");
		press("ArrowRight");
		act(() => outside.focus());
		act(() => vi.advanceTimersByTime(10));

		expect(card("a").hasAttribute("data-lifted")).toBe(false);
		expect(ids("Planned")).toEqual(["a", "b", "c"]);
		expect(onMove).not.toHaveBeenCalled();
	});

	it("卡片名称取自 getCardLabel，缺省时用 id", () => {
		renderBoard({ getCardLabel: undefined });

		pickUp("a");

		expect(announced()).toMatch(/^Picked up a\./);
	});
});

describe("规则", () => {
	it("canMove 拒绝一步移动：位置不变，原因显示在提示里", () => {
		renderBoard({
			canMove: (move) =>
				move.to.columnId === "doing"
					? { allowed: false, reason: "Blocked by #3" }
					: { allowed: true },
		});

		pickUp("a");
		press("ArrowRight");

		expect(ids("Planned")).toEqual(["a", "b", "c"]);
		expect(document.querySelector(".v-kanban__notice")?.textContent).toBe("Blocked by #3");
	});

	it("自动排序列：进入时落在入口一端，列内上下移动被拒绝并说明原因", () => {
		renderBoard({ order: { todo: ["a", "b"], doing: ["d"], done: ["c"] } });

		pickUp("a");
		press("ArrowRight");
		press("ArrowRight");
		expect(ids("Done")).toEqual(["a", "c"]);
		expect(announced()).toBe("Done, position 1 of 2.");

		press("ArrowDown");

		expect(ids("Done")).toEqual(["a", "c"]);
		expect(document.querySelector(".v-kanban__notice")?.textContent).toBe(
			"This column is sorted automatically. Cards can't be reordered by hand.",
		);
	});

	it("放下时再判定一次 canMove：被拒绝则回到原位", () => {
		let allow = true;
		const onMove = vi.fn();
		renderBoard({
			onMove,
			canMove: () => (allow ? { allowed: true } : { allowed: false, reason: "Locked" }),
		});

		pickUp("a");
		press("ArrowRight");
		allow = false;
		press(" ");

		expect(onMove).not.toHaveBeenCalled();
		expect(ids("Planned")).toEqual(["a", "b", "c"]);
		expect(document.querySelector(".v-kanban__notice")?.textContent).toBe("Locked");
	});
});

describe("本地化", () => {
	it("zh-CN 播报全部使用中文", () => {
		renderBoard({ locale: "zh-CN" });

		const hint = document.getElementById(card("a").getAttribute("aria-describedby") ?? "");
		expect(hint?.textContent).toBe(
			"按空格或回车拿起这张卡片，然后用方向键移动，空格或回车放下，Esc 取消。",
		);

		pickUp("a");
		expect(announced()).toBe(
			"已拿起 Task A。Planned，第 1 个，共 3 个。用方向键移动，空格或回车放下，Esc 取消。",
		);
		press("ArrowDown");
		expect(announced()).toBe("Planned，第 2 个，共 3 个。");
		press("ArrowUp");
		press("ArrowUp");
		expect(announced()).toBe("已到边缘，无法继续移动。Planned，第 1 个，共 3 个。");
		press("ArrowRight");
		press(" ");
		expect(announced()).toBe("已放下 Task A。In progress，第 1 个，共 2 个。");
		pickUp("a");
		press("Escape");
		expect(announced()).toBe("已取消移动。Task A 回到 In progress，第 1 个，共 2 个。");
	});
});

describe("不干扰页面", () => {
	it("拿起期间方向键、空格、Enter、Esc 不会传给页面级快捷键，放下后恢复", () => {
		const page = vi.fn();
		window.addEventListener("keydown", page);
		renderBoard();

		press("ArrowDown", document.body);
		expect(page).toHaveBeenCalledTimes(1);
		page.mockClear();

		pickUp("a");
		expect(page).not.toHaveBeenCalled(); // 拿起的那一下也被拦下
		for (const key of ["ArrowDown", "ArrowRight", "ArrowUp", "Enter"]) press(key);
		expect(page).not.toHaveBeenCalled();

		press("ArrowDown", document.body);
		expect(page).toHaveBeenCalledTimes(1);
		window.removeEventListener("keydown", page);
	});

	it("拿起期间不会开始指针拖拽", () => {
		renderBoard();

		pickUp("a");
		fireEvent.pointerDown(card("b"), {
			pointerId: 1,
			pointerType: "mouse",
			isPrimary: true,
			button: 0,
			clientX: 5,
			clientY: 5,
		});
		fireEvent.pointerMove(document, {
			pointerId: 1,
			pointerType: "mouse",
			clientX: 80,
			clientY: 80,
		});

		expect(document.querySelector("[data-placeholder]")).toBeNull();
	});
});

describe("键盘细节", () => {
	it("按住空格或 Enter 产生的重复事件既不拿起也不放下", () => {
		const onMove = vi.fn();
		renderBoard({ onMove });
		card("a").focus();

		fireEvent.keyDown(card("a"), { key: " ", repeat: true });
		expect(card("a").hasAttribute("data-lifted")).toBe(false);

		pickUp("a");
		press("ArrowRight");
		fireEvent.keyDown(document.activeElement as Element, { key: " ", repeat: true });

		expect(card("a").getAttribute("data-lifted")).toBe("true");
		expect(onMove).not.toHaveBeenCalled();
	});

	it("带修饰键或输入法组合期间的按键不被接管，方向键重复则继续移动", () => {
		renderBoard();
		pickUp("a");

		const withAlt = new KeyboardEvent("keydown", {
			key: "ArrowRight",
			altKey: true,
			bubbles: true,
			cancelable: true,
		});
		card("a").dispatchEvent(withAlt);
		const composing = new KeyboardEvent("keydown", {
			key: "ArrowRight",
			isComposing: true,
			bubbles: true,
			cancelable: true,
		});
		card("a").dispatchEvent(composing);
		expect(withAlt.defaultPrevented).toBe(false);
		expect(composing.defaultPrevented).toBe(false);
		expect(ids("Planned")).toEqual(["a", "b", "c"]);

		fireEvent.keyDown(card("a"), { key: "ArrowDown", repeat: true });
		expect(ids("Planned")).toEqual(["b", "a", "c"]);
	});

	it("拿起期间别处的输入框里按空格，不会把卡片放下", () => {
		const onMove = vi.fn();
		renderBoard({
			onMove,
			renderCard: (task) => (
				<input aria-label={`field-${task.id}`} defaultValue={task.title} />
			),
		});
		pickUp("a");
		press("ArrowRight");

		fireEvent.keyDown(screen.getByLabelText("field-b"), { key: " " });

		expect(onMove).not.toHaveBeenCalled();
		expect(card("a").getAttribute("data-lifted")).toBe("true");
	});

	it("Tab 离开被拿起的卡片即取消，焦点按 Tab 的方向走，不被拉回", () => {
		const onMove = vi.fn();
		renderBoard({ onMove, renderCard: (task) => <button type="button">{task.title}</button> });
		pickUp("a");
		press("ArrowRight");

		fireEvent.keyDown(card("a"), { key: "Tab" });

		expect(card("a").hasAttribute("data-lifted")).toBe(false);
		expect(ids("Planned")).toEqual(["a", "b", "c"]);
		expect(announced()).toMatch(/^Move cancelled/);
		expect(onMove).not.toHaveBeenCalled();
	});

	it("焦点移到别的卡片也取消拿起", () => {
		vi.useFakeTimers();
		renderBoard();
		pickUp("a");
		press("ArrowRight");

		act(() => card("b").focus());
		act(() => vi.advanceTimersByTime(10));

		expect(card("a").hasAttribute("data-lifted")).toBe(false);
		expect(ids("Planned")).toEqual(["a", "b", "c"]);
		expect(document.activeElement).toBe(card("b"));
	});

	it("从自动排序列拿起，离开后可以按反方向键回到它", () => {
		renderBoard({ cards: withXY, order: { todo: ["a"], doing: [], done: ["x", "y"] } });

		pickUp("y");
		press("ArrowLeft");
		expect(ids("In progress")).toEqual(["y"]);
		press("ArrowRight");

		expect(ids("Done")).toEqual(["x", "y"]);
		expect(announced()).toBe("Done, position 2 of 2.");
	});

	it("重复被拒绝的同一个操作，提示每次都重新出现，读屏才会再次播报", () => {
		renderBoard({ cards: withXY, order: { todo: ["a"], doing: [], done: ["x", "y"] } });
		pickUp("x");
		press("ArrowDown");
		const first = document.querySelector(".v-kanban__notice span");

		press("ArrowDown");
		const second = document.querySelector(".v-kanban__notice span");

		expect(second?.textContent).toBe(first?.textContent);
		expect(second).not.toBe(first);
	});

	it("键盘放下后保存失败：卡片回到原位，焦点仍在它身上", async () => {
		const onMoveError = vi.fn();
		renderBoard({ onMove: () => Promise.reject(new Error("no")), onMoveError });
		pickUp("a");
		press("ArrowRight");

		await act(async () => press(" "));

		expect(ids("Planned")).toEqual(["a", "b", "c"]);
		expect(onMoveError).toHaveBeenCalledTimes(1);
		expect(document.activeElement).toBe(card("a"));
	});

	it("拿起期间看板变成只读：放弃拿起，不提交", () => {
		const onMove = vi.fn();
		const view = renderBoard({ onMove });
		pickUp("a");
		press("ArrowRight");

		view.rerender(
			<Board
				columns={columns}
				cards={tasks}
				order={order}
				renderCard={(task) => <span>{task.title}</span>}
			/>,
		);

		expect(ids("Planned")).toEqual(["a", "b", "c"]);
		expect(onMove).not.toHaveBeenCalled();
	});
});

describe("「移到…」菜单", () => {
	const trigger = (id: string) =>
		card(id).querySelector('[aria-haspopup="menu"]') as HTMLButtonElement;
	const open = (id: string) => {
		fireEvent.click(trigger(id));
		return screen.getByRole("menu");
	};

	it("每张可编辑卡片有菜单按钮：名称带卡片，默认收起", () => {
		renderBoard();

		const button = trigger("a");
		expect(button.getAttribute("aria-label")).toBe("Move Task A to another column");
		expect(button.textContent).toBe("Move to…");
		expect(button.getAttribute("aria-haspopup")).toBe("menu");
		expect(button.getAttribute("aria-expanded")).toBe("false");
		expect(screen.queryByRole("menu")).toBeNull();
	});

	it("点开后列出其他列，焦点落在第一项", () => {
		renderBoard();

		const menu = open("a");

		expect(trigger("a").getAttribute("aria-expanded")).toBe("true");
		const items = within(menu).getAllByRole("menuitem");
		expect(items.map((item) => item.textContent)).toEqual(["In progress", "Done"]);
		expect(document.activeElement).toBe(items[0]);
	});

	it("选择目标列：移到该列末尾，提交、播报、菜单关闭，焦点回到卡片", () => {
		const onMove = vi.fn<(move: BoardMove) => void>();
		renderBoard({ onMove });

		fireEvent.click(within(open("a")).getByRole("menuitem", { name: "In progress" }));

		expect(onMove.mock.calls[0][0]).toMatchObject({
			cardId: "a",
			to: { columnId: "doing", index: 1 },
			previousId: "d",
			nextId: null,
		});
		expect(announced()).toBe("Moved Task A to In progress, position 2 of 2.");
		expect(ids("In progress")).toEqual(["d", "a"]);
		expect(screen.queryByRole("menu")).toBeNull();
		expect(document.activeElement).toBe(card("a"));
	});

	it("键盘：方向键只在菜单项之间移动并循环，不会立即移动卡片；Enter 才选中", () => {
		const onMove = vi.fn();
		renderBoard({ onMove });
		trigger("a").focus();

		fireEvent.keyDown(trigger("a"), { key: "ArrowDown" });
		const menu = screen.getByRole("menu");
		const [first, second] = within(menu).getAllByRole("menuitem");
		expect(document.activeElement).toBe(first);

		fireEvent.keyDown(menu, { key: "ArrowDown" });
		expect(document.activeElement).toBe(second);
		fireEvent.keyDown(menu, { key: "ArrowDown" });
		expect(document.activeElement).toBe(first);
		fireEvent.keyDown(menu, { key: "ArrowUp" });
		expect(document.activeElement).toBe(second);
		fireEvent.keyDown(menu, { key: "Home" });
		expect(document.activeElement).toBe(first);
		fireEvent.keyDown(menu, { key: "End" });
		expect(document.activeElement).toBe(second);
		expect(onMove).not.toHaveBeenCalled();

		fireEvent.click(second);
		expect(onMove).toHaveBeenCalledTimes(1);
	});

	it("Esc 关闭菜单并把焦点还给按钮，不取消别的东西", () => {
		renderBoard();
		trigger("a").focus();
		const menu = open("a");

		fireEvent.keyDown(menu, { key: "Escape" });

		expect(screen.queryByRole("menu")).toBeNull();
		expect(document.activeElement).toBe(trigger("a"));
	});

	it("点击菜单之外关闭", () => {
		renderBoard();
		open("a");

		fireEvent.pointerDown(document.body);

		expect(screen.queryByRole("menu")).toBeNull();
	});

	it("移入自动排序列落在入口一端；被 canMove 拒绝时显示原因", () => {
		const onMove = vi.fn<(move: BoardMove) => void>();
		renderBoard({
			onMove,
			order: { todo: ["a", "b"], doing: ["d"], done: ["c"] },
			canMove: (move) =>
				move.cardId === "b" ? { allowed: false, reason: "B is locked" } : { allowed: true },
		});

		fireEvent.click(within(open("a")).getByRole("menuitem", { name: "Done" }));
		expect(onMove.mock.calls[0][0]).toMatchObject({
			to: { columnId: "done", index: 0 },
			nextId: "c",
		});

		fireEvent.click(within(open("b")).getByRole("menuitem", { name: "In progress" }));
		expect(onMove).toHaveBeenCalledTimes(1);
		expect(document.querySelector(".v-kanban__notice")?.textContent).toBe("B is locked");
	});

	it("moveMenu 可设为常显或关闭；只读看板与被禁用的卡片没有菜单", () => {
		const view = renderBoard({ moveMenu: "always" });
		expect(card("a").querySelector(".v-kanban__card-tools")?.getAttribute("data-menu")).toBe(
			"always",
		);
		view.unmount();

		renderBoard({ moveMenu: "none" });
		expect(card("a").querySelector(".v-kanban__card-tools")).toBeNull();
		document.body.innerHTML = "";

		renderBoard({ onMove: undefined });
		expect(card("a").querySelector(".v-kanban__card-tools")).toBeNull();
		document.body.innerHTML = "";

		renderBoard({ isDraggable: (task) => task.id !== "a" });
		expect(card("a").querySelector(".v-kanban__card-tools")).toBeNull();
		expect(card("b").querySelector(".v-kanban__card-tools")).not.toBeNull();
	});

	it("菜单按钮上按下指针不会开始拖拽", () => {
		renderBoard();

		fireEvent.pointerDown(trigger("a"), {
			pointerId: 1,
			pointerType: "mouse",
			isPrimary: true,
			button: 0,
			clientX: 5,
			clientY: 5,
		});
		fireEvent.pointerMove(document, {
			pointerId: 1,
			pointerType: "mouse",
			clientX: 80,
			clientY: 80,
		});

		expect(document.querySelector("[data-placeholder]")).toBeNull();
	});

	it("zh-CN：按钮、菜单名称与播报都是中文", () => {
		renderBoard({ locale: "zh-CN" });

		expect(trigger("a").textContent).toBe("移到…");
		expect(trigger("a").getAttribute("aria-label")).toBe("把 Task A 移到其他列");
		fireEvent.click(within(open("a")).getByRole("menuitem", { name: "In progress" }));
		expect(announced()).toBe("已把 Task A 移到 In progress，第 2 个，共 2 个。");
	});
});

describe("本地化：拒绝提示", () => {
	it("自动排序列内上下移动的拒绝原因是中文", () => {
		renderBoard({
			locale: "zh-CN",
			cards: withXY,
			order: { todo: ["a"], doing: [], done: ["x", "y"] },
		});

		pickUp("x");
		press("ArrowDown");

		expect(document.querySelector(".v-kanban__notice")?.textContent).toBe(
			"该列自动排序，不能手动调整顺序",
		);
	});
});
