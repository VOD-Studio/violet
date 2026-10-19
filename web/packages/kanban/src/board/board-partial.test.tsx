import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Board, type BoardColumn, type BoardProps } from "./board.tsx";

interface Task {
	id: string;
	title: string;
}

const tasks: Task[] = ["a", "b", "c", "d"].map((id) => ({ id, title: `Task ${id.toUpperCase()}` }));
const columns: BoardColumn[] = [
	{ id: "todo", title: "Todo" },
	{ id: "done", title: "Done", total: 23 },
];
const order = { todo: ["a", "b"], done: ["c", "d"] };

type Props = Partial<BoardProps<Task, BoardColumn>>;
function renderBoard(props: Props = {}) {
	return render(
		<Board
			columns={columns}
			cards={tasks}
			order={order}
			renderCard={(task) => <span>{task.title}</span>}
			getCardLabel={(task) => task.title}
			{...props}
		/>,
	);
}

const column = (name: string) => screen.getByRole("group", { name });
const count = (name: string) => column(name).querySelector(".v-kanban__count")?.textContent;

describe("列的卡片总数", () => {
	it("设置 total 的列：默认列头显示总数，读屏朗读总数；没设置的列仍是提供的张数", () => {
		renderBoard();

		expect(count("Done")).toBe("23Cards: 23");
		expect(count("Todo")).toBe("2Cards: 2");
		expect(within(column("Done")).getAllByRole("listitem")).toHaveLength(2);
	});

	it("renderColumnHeader 拿到的 count 也是总数", () => {
		renderBoard({
			renderColumnHeader: (col, { count: total }) => <h3>{`${col.title}:${total}`}</h3>,
		});

		expect(screen.getByText("Done:23")).toBeTruthy();
		expect(screen.getByText("Todo:2")).toBeTruthy();
	});

	it("total 小于提供的张数或不是有限数时忽略", () => {
		const view = renderBoard({
			columns: [
				{ id: "todo", title: "Todo" },
				{ id: "done", title: "Done", total: 1 },
			],
		});
		expect(count("Done")).toBe("2Cards: 2");
		view.unmount();

		for (const total of [Number.NaN, Number.POSITIVE_INFINITY, -5]) {
			const next = renderBoard({
				columns: [
					{ id: "todo", title: "Todo" },
					{ id: "done", title: "Done", total },
				],
			});
			expect(count("Done")).toBe("2Cards: 2");
			next.unmount();
		}
	});

	it("小数总数向下取整", () => {
		renderBoard({
			columns: [
				{ id: "todo", title: "Todo" },
				{ id: "done", title: "Done", total: 7.9 },
			],
		});

		expect(count("Done")).toBe("7Cards: 7");
	});

	it("列切换布局的标签也显示总数", () => {
		renderBoard({ layout: "switcher" });

		expect(screen.getByRole("tab", { name: "Done Cards: 23" })).toBeTruthy();
		expect(screen.getByRole("tab", { name: "Todo Cards: 2" })).toBeTruthy();
	});

	it("筛选时显示「匹配/总数」，匹配只统计提供的卡片", () => {
		renderBoard({ filter: (task) => task.id === "c" });

		expect(count("Done")).toBe("1/23Cards: 1 of 23");
	});
});

describe("列底插槽", () => {
	it("在列内卡片之后渲染；context 的 count 是总数，shown 是提供的张数", () => {
		const renderColumnFooter = vi.fn((col: BoardColumn) =>
			col.id === "done" ? <button type="button">more</button> : null,
		);
		renderBoard({ renderColumnFooter });

		const more = within(column("Done")).getByRole("button", { name: "more" });
		const list = column("Done").querySelector(".v-kanban__cards") as HTMLElement;
		expect(list.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(renderColumnFooter).toHaveBeenCalledWith(columns[1], { count: 23, shown: 2 });
		expect(renderColumnFooter).toHaveBeenCalledWith(columns[0], { count: 2, shown: 2 });
		expect(within(column("Todo")).queryByRole("button", { name: "more" })).toBeNull();
	});

	it("在快速添加之前", () => {
		renderBoard({
			renderColumnFooter: (col) =>
				col.id === "done" ? <button type="button">more</button> : null,
			onAddCard: () => {},
		});

		const more = within(column("Done")).getByRole("button", { name: "more" });
		const add = within(column("Done")).getByRole("button", { name: "Add card" });
		expect(more.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it("空列里也渲染（空提示之后）", () => {
		renderBoard({
			order: { todo: ["a", "b"], done: [] },
			renderColumnFooter: (col) =>
				col.id === "done" ? <button type="button">more</button> : null,
		});

		expect(within(column("Done")).getByText("No cards")).toBeTruthy();
		expect(within(column("Done")).getByRole("button", { name: "more" })).toBeTruthy();
	});

	it("返回 null 或 undefined 什么也不加", () => {
		renderBoard({ renderColumnFooter: () => null });

		expect(screen.queryByRole("button", { name: "more" })).toBeNull();
		expect(column("Done").querySelectorAll("button")).toHaveLength(0);
	});

	it("列切换布局里只渲染当前列的插槽", () => {
		renderBoard({
			layout: "switcher",
			defaultActiveColumn: "done",
			renderColumnFooter: (col) => <button type="button">{`more-${col.id}`}</button>,
		});

		expect(screen.getByRole("button", { name: "more-done" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "more-todo" })).toBeNull();
		fireEvent.click(screen.getByRole("tab", { name: /^Todo/ }));
		expect(screen.getByRole("button", { name: "more-todo" })).toBeTruthy();
	});

	it("折叠的列里插槽不可交互（与列体一起 inert）", () => {
		renderBoard({
			collapsible: true,
			defaultCollapsedColumns: ["done"],
			renderColumnFooter: (col) =>
				col.id === "done" ? <button type="button">more</button> : null,
		});

		const inner = column("Done").querySelector(".v-kanban__column-body-inner") as HTMLElement;
		expect(inner.hasAttribute("inert")).toBe(true);
		expect(inner.contains(screen.getByText("more", { selector: "button" }))).toBe(true);
	});
});
