import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyMove, type BoardMove, type BoardState, type Relation } from "../core/index.ts";
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

	it("列底快速添加仍在当前列里，提交时带着当前列的 id", async () => {
		const onAddCard = vi.fn();
		renderBoard({ onAddCard });

		fireEvent.click(tab(/^In progress/));
		fireEvent.click(
			within(screen.getByRole("tabpanel")).getByRole("button", { name: "Add card" }),
		);
		fireEvent.change(screen.getByRole("textbox"), { target: { value: "New one" } });
		fireEvent.submit(screen.getByRole("textbox").closest("form") as HTMLFormElement);
		await settle();

		expect(onAddCard).toHaveBeenCalledExactlyOnceWith({ columnId: "doing", title: "New one" });
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

describe("关系标记与跳转", () => {
	const relations: Relation[] = [
		{ sourceId: "a", targetId: "d", type: "extends" },
		{ sourceId: "b", targetId: "d", type: "fixes" },
		{ sourceId: "e", targetId: "c", type: "blocks" },
	];
	const marker = (id: string, text: string | RegExp) =>
		within(card(id)).getByRole("button", { name: text });
	const markersOf = (id: string) =>
		[...card(id).querySelectorAll(".v-kanban__marker")].map((item) => item.textContent);
	let scrollIntoView: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		scrollIntoView = vi.fn();
		Element.prototype.scrollIntoView = scrollIntoView as unknown as Element["scrollIntoView"];
	});
	afterEach(() => {
		// jsdom 没有 scrollIntoView，还原成没有
		delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("有关系的卡片带标记：从这张卡片的角度读，来源读正向，目标读反向", () => {
		renderBoard({ relations });

		expect(markersOf("a")).toEqual(["extends Task D"]);
		expect(markersOf("c")).toEqual(["is blocked by Task E"]);
		expect(markersOf("b")).toEqual(["fixes Task D"]);
	});

	it("没有关系的卡片没有标记；两端有一端不存在的关系不显示", () => {
		renderBoard({
			relations: [...relations, { sourceId: "a", targetId: "nowhere", type: "extends" }],
		});

		expect(card("a").querySelectorAll(".v-kanban__marker")).toHaveLength(1);
		fireEvent.click(tab(/^In progress/));
		expect(markersOf("d")).toEqual(["is extended by Task A", "is fixed by Task B"]);
		fireEvent.click(tab(/^Planned/));
		expect(card("a").querySelector(".v-kanban__markers")).not.toBeNull();
	});

	it("标记按钮的可访问名称包含可见文字，并说明会跳转", () => {
		renderBoard({ relations });

		expect(marker("a", "extends Task D, go to that card")).toBeTruthy();
		expect(marker("a", "extends Task D, go to that card").getAttribute("title")).toBe(
			"extends Task D",
		);
	});

	it("中文文案", () => {
		renderBoard({ relations, locale: "zh-CN" });

		expect(markersOf("a")).toEqual(["扩展 Task D"]);
		expect(marker("c", "被阻塞 Task E，跳转到该卡片")).toBeTruthy();
	});

	it("类型表可以覆盖读法", () => {
		renderBoard({
			relations: [{ sourceId: "a", targetId: "d", type: "relates" }],
			relationTypes: {
				relates: { label: "relates to", inverseLabel: "relates to", line: "solid" },
			},
		});

		expect(markersOf("a")).toEqual(["relates to Task D"]);
	});

	it("不画关系线，也不再有给读屏的关系汇总：标记按钮本身就是文字描述", () => {
		renderBoard({ relations });

		expect(document.querySelector(".v-kanban__relations")).toBeNull();
		expect(card("a").textContent).not.toContain("Relations:");
	});

	it("隐藏关系线的开关不影响标记", () => {
		renderBoard({ relations, hideRelations: true });

		expect(markersOf("a")).toEqual(["extends Task D"]);
	});

	it("columns 布局仍是关系线加汇总，没有标记", () => {
		render(
			<Board
				columns={columns}
				cards={tasks}
				order={initial}
				relations={relations}
				getCardLabel={(task) => task.title}
				renderCard={(task) => <span>{task.title}</span>}
			/>,
		);

		expect(document.querySelector(".v-kanban__marker")).toBeNull();
		expect(card("a").textContent).toContain("Relations: extends Task D");
	});

	it("点击标记：目标在同一列时聚焦它、滚到视口中央并短暂强调", () => {
		renderBoard({ relations: [{ sourceId: "a", targetId: "c", type: "extends" }] });

		fireEvent.click(marker("a", /extends Task C/));

		expect(document.activeElement).toBe(card("c"));
		expect(scrollIntoView).toHaveBeenCalledWith(
			expect.objectContaining({ block: "center", behavior: "smooth" }),
		);
		expect(card("c").getAttribute("data-arrived")).toBe("true");
		expect(card("a").hasAttribute("data-arrived")).toBe(false);
	});

	it("点击标记：目标在别的列时先切到那一列，再聚焦并滚动", () => {
		const onActiveColumnChange = vi.fn();
		renderBoard({ relations, onActiveColumnChange });

		fireEvent.click(marker("a", /extends Task D/));

		expect(onActiveColumnChange).toHaveBeenCalledExactlyOnceWith("doing");
		expect(tab(/^In progress/).getAttribute("aria-selected")).toBe("true");
		expect(panelCards()).toEqual(["d"]);
		expect(document.activeElement).toBe(card("d"));
		expect(scrollIntoView).toHaveBeenCalledOnce();
		expect(card("d").getAttribute("data-arrived")).toBe("true");
	});

	it("跳过去之后目标卡片上有指回来的标记，可以原路回去", () => {
		renderBoard({ relations });

		fireEvent.click(marker("a", /extends Task D/));
		expect(markersOf("d")).toContain("is extended by Task A");
		fireEvent.click(marker("d", /is extended by Task A/));

		expect(tab(/^Planned/).getAttribute("aria-selected")).toBe("true");
		expect(document.activeElement).toBe(card("a"));
	});

	it("强调一会儿后自动取消", () => {
		vi.useFakeTimers();
		renderBoard({ relations: [{ sourceId: "a", targetId: "c", type: "extends" }] });

		fireEvent.click(marker("a", /extends Task C/));
		expect(card("c").getAttribute("data-arrived")).toBe("true");
		act(() => vi.advanceTimersByTime(2000));

		expect(card("c").hasAttribute("data-arrived")).toBe(false);
	});

	it("偏好减弱动态时滚动不用平滑", () => {
		vi.stubGlobal("matchMedia", (query: string) => ({
			matches: query.includes("reduce"),
			media: query,
			addEventListener() {},
			removeEventListener() {},
		}));
		renderBoard({ relations: [{ sourceId: "a", targetId: "c", type: "extends" }] });

		fireEvent.click(marker("a", /extends Task C/));

		expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ behavior: "auto" }));
	});

	it("只读看板的卡片没有标记之外的入口，也能被跳转聚焦（不进 Tab 顺序）", () => {
		renderBoard({ relations, onMove: undefined, readOnly: true });

		expect(card("c").getAttribute("tabindex")).toBe("-1");
		expect(card("a").getAttribute("tabindex")).toBe("-1");
		fireEvent.click(marker("a", /extends Task D/));
		expect(document.activeElement).toBe(card("d"));
	});

	it("没有关系的只读卡片仍不可聚焦", () => {
		renderBoard({
			relations: [{ sourceId: "a", targetId: "b", type: "extends" }],
			readOnly: true,
		});

		expect(card("c").hasAttribute("tabindex")).toBe(false);
	});

	it("点击标记不选中卡片，也不被当作拖拽起点", () => {
		const onSelectedCardChange = vi.fn();
		renderBoard({ relations, onSelectedCardChange });

		expect(
			card("a").querySelector(".v-kanban__markers")?.hasAttribute("data-kanban-no-drag"),
		).toBe(true);
		fireEvent.click(marker("a", /extends Task D/));

		expect(onSelectedCardChange).not.toHaveBeenCalled();
	});

	it("键盘：Tab 到标记按钮，Enter 激活跳转", () => {
		renderBoard({ relations, isDraggable: () => false });

		const button = marker("a", /extends Task D/);
		button.focus();
		fireEvent.keyDown(button, { key: "Enter" });
		fireEvent.click(button);

		expect(document.activeElement).toBe(card("d"));
	});
});
