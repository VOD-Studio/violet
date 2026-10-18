import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { applyMove, type BoardMove, type BoardState } from "../core/index.ts";
import { Board, type BoardColumn, type BoardProps } from "./board.tsx";

interface Task {
	id: string;
	title: string;
}

const tasks: Task[] = ["a", "b", "c", "d", "e"].map((id) => ({
	id,
	title: `Task ${id.toUpperCase()}`,
}));
const columns: BoardColumn[] = [
	{ id: "todo", title: "Planned" },
	{ id: "doing", title: "In progress" },
	{ id: "done", title: "Done" },
];
const columnIds = columns.map((column) => column.id);
const initial = { todo: ["a", "b", "c"], doing: ["d"], done: ["e"] };

type Props = Partial<BoardProps<Task, BoardColumn>>;

/** 受控的数据：onMove 保存后按新顺序渲染，和站点里的用法一致。 */
function Harness({ onMove, ...props }: Props) {
	const [order, setOrder] = useState<BoardState["order"]>(initial);
	return (
		<Board
			layout="switcher"
			columns={columns}
			cards={tasks}
			order={order}
			getCardLabel={(task) => task.title}
			renderCard={(task) => <span>{task.title}</span>}
			onMove={async (move) => {
				await onMove?.(move);
				setOrder(
					(previous) => applyMove({ columns: columnIds, order: previous }, move).order,
				);
			}}
			{...props}
		/>
	);
}

const renderBoard = (props: Props = {}) => render(<Harness {...props} />);

const card = (id: string) => document.querySelector(`[data-card-id="${id}"]`) as HTMLElement;
const tab = (name: string | RegExp) => screen.getByRole("tab", { name });
const panelCards = () =>
	within(screen.getByRole("tabpanel"))
		.queryAllByRole("listitem")
		.map((item) => item.getAttribute("data-card-id"));
const announced = () => document.querySelector(".v-kanban__announcer")?.textContent;
const trigger = (id: string) =>
	card(id).querySelector('[aria-haspopup="menu"]') as HTMLButtonElement;
const press = (key: string, target: Element = document.activeElement ?? document.body) =>
	fireEvent.keyDown(target, { key });
/** 让 onMove 的 Promise 与随后的状态更新落定。 */
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

describe("列切换器", () => {
	it("顶部是标签条，每列一个标签，带卡片数；默认显示第一列", () => {
		renderBoard();

		const list = screen.getByRole("tablist", { name: "Columns" });
		const tabs = within(list).getAllByRole("tab");
		expect(tabs.map((item) => item.querySelector(".v-kanban__tab-title")?.textContent)).toEqual(
			["Planned", "In progress", "Done"],
		);
		// 可访问名称是标题加读屏的数量句子，可见的是数字
		for (const name of ["Planned Cards: 3", "In progress Cards: 1", "Done Cards: 1"])
			expect(within(list).getByRole("tab", { name })).toBeTruthy();
		expect(tabs.map((item) => item.getAttribute("aria-selected"))).toEqual([
			"true",
			"false",
			"false",
		]);
		expect(panelCards()).toEqual(["a", "b", "c"]);
	});

	it("只渲染当前列：别的列的卡片不在文档里", () => {
		renderBoard();

		expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
		expect(card("d")).toBeNull();
		expect(card("e")).toBeNull();
	});

	it("面板以标签为名称，标签指向面板；列头不再重复标题", () => {
		renderBoard();

		const panel = screen.getByRole("tabpanel", { name: /^Planned/ });
		expect(tab(/^Planned/).getAttribute("aria-controls")).toBe(panel.id);
		expect(tab(/^In progress/).hasAttribute("aria-controls")).toBe(false);
		expect(panel.querySelector(".v-kanban__column-header")).toBeNull();
	});

	it("点击标签切换到那一列", () => {
		renderBoard();

		fireEvent.click(tab(/^In progress/));

		expect(panelCards()).toEqual(["d"]);
		expect(tab(/^In progress/).getAttribute("aria-selected")).toBe("true");
		expect(tab(/^Planned/).getAttribute("aria-selected")).toBe("false");
	});

	it("只有选中的标签在 Tab 顺序里（roving tabindex）", () => {
		renderBoard();

		expect(tab(/^Planned/).tabIndex).toBe(0);
		expect(tab(/^In progress/).tabIndex).toBe(-1);
		expect(tab(/^Done/).tabIndex).toBe(-1);
	});

	it("方向键移动焦点并立即切换，到头循环；Home 与 End 到首尾", () => {
		renderBoard();

		tab(/^Planned/).focus();
		press("ArrowRight");
		expect(document.activeElement).toBe(tab(/^In progress/));
		expect(panelCards()).toEqual(["d"]);

		press("ArrowRight");
		press("ArrowRight");
		expect(document.activeElement).toBe(tab(/^Planned/));

		press("ArrowLeft");
		expect(document.activeElement).toBe(tab(/^Done/));
		expect(panelCards()).toEqual(["e"]);

		press("Home");
		expect(document.activeElement).toBe(tab(/^Planned/));
		press("End");
		expect(document.activeElement).toBe(tab(/^Done/));
	});

	it("带修饰键的方向键留给浏览器", () => {
		renderBoard();

		tab(/^Planned/).focus();
		fireEvent.keyDown(document.activeElement as Element, { key: "ArrowRight", altKey: true });

		expect(document.activeElement).toBe(tab(/^Planned/));
		expect(panelCards()).toEqual(["a", "b", "c"]);
	});

	it("defaultActiveColumn 给出初始列；不是现有的列时落到第一列", () => {
		const view = renderBoard({ defaultActiveColumn: "done" });
		expect(panelCards()).toEqual(["e"]);
		view.unmount();

		renderBoard({ defaultActiveColumn: "nowhere" });
		expect(panelCards()).toEqual(["a", "b", "c"]);
	});

	it("受控：以 activeColumn 为准，点击只通知", () => {
		const onActiveColumnChange = vi.fn();
		const view = renderBoard({ activeColumn: "doing", onActiveColumnChange });
		expect(panelCards()).toEqual(["d"]);

		fireEvent.click(tab(/^Done/));

		expect(onActiveColumnChange).toHaveBeenCalledExactlyOnceWith("done");
		expect(panelCards()).toEqual(["d"]);

		view.rerender(<Harness activeColumn="done" onActiveColumnChange={onActiveColumnChange} />);
		expect(panelCards()).toEqual(["e"]);
	});

	it("点击已选中的标签不通知", () => {
		const onActiveColumnChange = vi.fn();
		renderBoard({ onActiveColumnChange });

		fireEvent.click(tab(/^Planned/));

		expect(onActiveColumnChange).not.toHaveBeenCalled();
	});

	it("筛选生效时标签上显示「匹配/总数」，不匹配的卡片仍在原列淡化", () => {
		renderBoard({ filter: (task) => task.id !== "b" });

		expect(tab(/^Planned/).textContent).toBe("Planned 2/3Cards: 2 of 3");
		expect(tab("Planned Cards: 2 of 3")).toBe(tab(/^Planned/));
		expect(card("b").getAttribute("data-dimmed")).toBe("true");
	});

	it("没有列时不渲染标签条", () => {
		renderBoard({ columns: [], cards: [], order: {} });

		expect(screen.queryByRole("tablist")).toBeNull();
	});

	it("自定义列头仍然渲染在面板里", () => {
		renderBoard({
			renderColumnHeader: (column, { count }) => (
				<p data-testid="custom-header">
					{column.title}: {count}
				</p>
			),
		});

		expect(screen.getByTestId("custom-header").textContent).toBe("Planned: 3");
	});

	it("默认的 columns 布局没有标签条，各列并排", () => {
		render(
			<Board
				columns={columns}
				cards={tasks}
				order={initial}
				renderCard={(task) => <span>{task.title}</span>}
			/>,
		);

		expect(screen.queryByRole("tablist")).toBeNull();
		expect(screen.getAllByRole("group", { name: /Planned|In progress|Done/ })).toHaveLength(3);
	});
});

describe("列切换布局里不适用的功能", () => {
	it("折叠按钮不出现，持久化的折叠状态也不让当前列收起", () => {
		renderBoard({ collapsible: true, defaultCollapsedColumns: ["todo"] });

		expect(screen.queryByRole("button", { name: /Collapse|Expand/ })).toBeNull();
		expect(screen.getByRole("tabpanel").hasAttribute("data-collapsed")).toBe(false);
		expect(panelCards()).toEqual(["a", "b", "c"]);
	});

	it("不画关系线", () => {
		renderBoard({ relations: [{ sourceId: "a", targetId: "b", type: "extends" }] });

		expect(document.querySelector(".v-kanban__relations")).toBeNull();
	});
});

describe("跨列移动", () => {
	it("「移到…」菜单默认常显：只有一列可见，悬停才出现会让它难以发现", () => {
		renderBoard();

		expect(card("a").querySelector(".v-kanban__card-tools")?.getAttribute("data-menu")).toBe(
			"always",
		);
	});

	it("moveMenu 设为 none 时仍然关闭", () => {
		renderBoard({ moveMenu: "none" });

		expect(card("a").querySelector(".v-kanban__card-tools")).toBeNull();
	});

	it("菜单移动后切到卡片所在的列，焦点在卡片上", async () => {
		const onMove = vi.fn<(move: BoardMove) => void>();
		const onActiveColumnChange = vi.fn();
		renderBoard({ onMove, onActiveColumnChange });

		fireEvent.click(trigger("a"));
		fireEvent.click(screen.getByRole("menuitem", { name: "In progress" }));
		await settle();

		expect(onMove).toHaveBeenCalledOnce();
		expect(onActiveColumnChange).toHaveBeenCalledExactlyOnceWith("doing");
		expect(tab(/^In progress/).getAttribute("aria-selected")).toBe("true");
		expect(panelCards()).toEqual(["d", "a"]);
		expect(document.activeElement).toBe(card("a"));
		expect(announced()).toBe("Moved Task A to In progress, position 2 of 2.");
	});

	it("被 canMove 拒绝时留在原来的列并给出原因", async () => {
		renderBoard({ canMove: () => ({ allowed: false, reason: "Locked" }) });

		fireEvent.click(trigger("a"));
		fireEvent.click(screen.getByRole("menuitem", { name: "In progress" }));
		await settle();

		expect(tab(/^Planned/).getAttribute("aria-selected")).toBe("true");
		expect(panelCards()).toEqual(["a", "b", "c"]);
		expect(document.querySelector(".v-kanban__notice")?.textContent).toBe("Locked");
	});

	it("保存失败时卡片回到原位，显示的列也回到原来的列", async () => {
		const onMoveError = vi.fn();
		render(
			<Board
				layout="switcher"
				columns={columns}
				cards={tasks}
				order={initial}
				getCardLabel={(task) => task.title}
				renderCard={(task) => <span>{task.title}</span>}
				onMove={() => Promise.reject(new Error("save failed"))}
				onMoveError={onMoveError}
			/>,
		);

		fireEvent.click(trigger("a"));
		fireEvent.click(screen.getByRole("menuitem", { name: "In progress" }));
		expect(tab(/^In progress/).getAttribute("aria-selected")).toBe("true");
		await settle();

		expect(onMoveError).toHaveBeenCalledOnce();
		expect(tab(/^Planned/).getAttribute("aria-selected")).toBe("true");
		expect(panelCards()).toEqual(["a", "b", "c"]);
		expect(document.activeElement).toBe(card("a"));
	});

	it("键盘左右方向键换列时显示的列跟着卡片，放下后留在新列", async () => {
		const onMove = vi.fn<(move: BoardMove) => void>();
		renderBoard({ onMove });

		card("a").focus();
		press(" ", card("a"));
		press("ArrowRight");

		expect(tab(/^In progress/).getAttribute("aria-selected")).toBe("true");
		expect(panelCards()).toEqual(["a", "d"]);
		expect(document.activeElement).toBe(card("a"));

		press("Enter");
		await settle();

		expect(onMove).toHaveBeenCalledOnce();
		expect(tab(/^In progress/).getAttribute("aria-selected")).toBe("true");
		expect(panelCards()).toEqual(["a", "d"]);
		expect(document.activeElement).toBe(card("a"));
	});

	it("键盘取消后显示的列回到出发的列", () => {
		const onMove = vi.fn();
		renderBoard({ onMove });

		card("a").focus();
		press(" ", card("a"));
		press("ArrowRight");
		press("ArrowRight");
		expect(tab(/^Done/).getAttribute("aria-selected")).toBe("true");

		press("Escape");

		expect(tab(/^Planned/).getAttribute("aria-selected")).toBe("true");
		expect(panelCards()).toEqual(["a", "b", "c"]);
		expect(document.activeElement).toBe(card("a"));
		expect(onMove).not.toHaveBeenCalled();
	});

	it("列内的上下移动不切换列", async () => {
		const onActiveColumnChange = vi.fn();
		renderBoard({ onActiveColumnChange });

		card("a").focus();
		press(" ", card("a"));
		press("ArrowDown");
		press("Enter");
		await settle();

		expect(onActiveColumnChange).not.toHaveBeenCalled();
		expect(panelCards()).toEqual(["b", "a", "c"]);
	});
});
