import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { EDITING_EVENT } from "../pan-region.ts";
import { Board, type BoardColumn, type BoardProps } from "./board.tsx";

interface Task {
	id: string;
	title: string;
	done?: boolean;
}

const tasks: Task[] = [
	{ id: "a", title: "Alpha" },
	{ id: "b", title: "Beta" },
	{ id: "c", title: "Gamma" },
	{ id: "d", title: "Delta" },
	{ id: "e", title: "Epsilon" },
];
const columns: BoardColumn[] = [
	{ id: "todo", title: "Todo" },
	{ id: "doing", title: "Doing" },
	{ id: "done", title: "Done" },
];
const order = { todo: ["a", "b", "c"], doing: ["d"], done: ["e"] };

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
const toggle = (name: string) =>
	within(column(name)).getByRole("button", { name: new RegExp(`(Collapse|Expand) ${name}`) });
const body = (name: string) => column(name).querySelector(".v-kanban__column-body") as HTMLElement;
const isCollapsed = (name: string) => column(name).getAttribute("data-collapsed") === "true";
const card = (id: string) => document.querySelector(`[data-card-id="${id}"]`) as HTMLElement;

describe("列折叠", () => {
	it("默认不可折叠：没有折叠按钮", () => {
		renderBoard();

		expect(screen.queryByRole("button", { name: /Collapse/ })).toBeNull();
	});

	it("collapsible 时每列头有折叠按钮：aria-expanded 与 aria-controls 指向列体，点击切换", () => {
		renderBoard({ collapsible: true });
		const button = toggle("Todo");

		expect(button.getAttribute("aria-expanded")).toBe("true");
		expect(button.getAttribute("aria-label")).toBe("Collapse Todo");
		expect(button.getAttribute("aria-controls")).toBe(body("Todo").id);
		expect(isCollapsed("Todo")).toBe(false);

		fireEvent.click(button);

		expect(button.getAttribute("aria-expanded")).toBe("false");
		expect(button.getAttribute("aria-label")).toBe("Expand Todo");
		expect(isCollapsed("Todo")).toBe(true);
		expect(isCollapsed("Doing")).toBe(false);

		fireEvent.click(button);

		expect(button.getAttribute("aria-expanded")).toBe("true");
		expect(isCollapsed("Todo")).toBe(false);
	});

	it("折叠的列体不可聚焦、不被读屏读到（inert），列头与计数仍在", () => {
		renderBoard({ collapsible: true, defaultCollapsedColumns: ["todo"] });

		expect(
			body("Todo").querySelector(".v-kanban__column-body-inner")?.hasAttribute("inert"),
		).toBe(true);
		expect(
			body("Doing").querySelector(".v-kanban__column-body-inner")?.hasAttribute("inert"),
		).toBe(false);
		expect(within(column("Todo")).getByText("Cards: 3")).toBeTruthy();
		expect(within(column("Todo")).getByRole("heading", { name: "Todo" })).toBeTruthy();
	});

	it("列可单独退出折叠：column.collapsible 为 false 的列没有按钮", () => {
		renderBoard({
			collapsible: true,
			columns: [
				{ id: "todo", title: "Todo" },
				{ id: "doing", title: "Doing", collapsible: false },
				{ id: "done", title: "Done" },
			],
		});

		expect(within(column("Todo")).queryByRole("button", { name: /Collapse/ })).not.toBeNull();
		expect(within(column("Doing")).queryByRole("button", { name: /Collapse/ })).toBeNull();
	});

	it("非受控：defaultCollapsedColumns 给出初始状态，变化通过 onCollapsedColumnsChange 报告完整列表", () => {
		const onChange = vi.fn();
		renderBoard({
			collapsible: true,
			defaultCollapsedColumns: ["done"],
			onCollapsedColumnsChange: onChange,
		});

		expect(isCollapsed("Done")).toBe(true);

		fireEvent.click(toggle("Todo"));
		expect(onChange).toHaveBeenLastCalledWith(["done", "todo"]);

		fireEvent.click(toggle("Done"));
		expect(onChange).toHaveBeenLastCalledWith(["todo"]);
	});

	it("受控：collapsedColumns 决定显示，点击只通知，等使用方更新后才变化", () => {
		const onChange = vi.fn();
		function Controlled() {
			const [collapsed, setCollapsed] = useState<string[]>([]);
			return (
				<Board
					columns={columns}
					cards={tasks}
					order={order}
					renderCard={(task) => <span>{task.title}</span>}
					collapsible
					collapsedColumns={collapsed}
					onCollapsedColumnsChange={(next) => {
						onChange(next);
						if (next.length < 2) setCollapsed(next);
					}}
				/>
			);
		}
		render(<Controlled />);

		fireEvent.click(toggle("Todo"));
		expect(isCollapsed("Todo")).toBe(true);
		fireEvent.click(toggle("Doing"));
		expect(onChange).toHaveBeenLastCalledWith(["todo", "doing"]);
		// 使用方没有接受第二次变化
		expect(isCollapsed("Doing")).toBe(false);
	});

	it("卡片被移到折叠的列时，该列自动展开", () => {
		const onChange = vi.fn();
		renderBoard({
			collapsible: true,
			defaultCollapsedColumns: ["done"],
			onCollapsedColumnsChange: onChange,
			onMove: () => {},
			moveMenu: "always",
		});

		const trigger = within(card("a")).getByRole("button", { name: /Move Alpha/ });
		fireEvent.click(trigger);
		fireEvent.click(screen.getByRole("menuitem", { name: "Done" }));

		expect(isCollapsed("Done")).toBe(false);
		expect(onChange).toHaveBeenLastCalledWith([]);
	});

	it("移到没有折叠的列时不改动折叠状态", () => {
		const onChange = vi.fn();
		renderBoard({
			collapsible: true,
			defaultCollapsedColumns: ["done"],
			onCollapsedColumnsChange: onChange,
			onMove: () => {},
			moveMenu: "always",
		});

		fireEvent.click(within(card("a")).getByRole("button", { name: /Move Alpha/ }));
		fireEvent.click(screen.getByRole("menuitem", { name: "Doing" }));

		expect(onChange).not.toHaveBeenCalled();
		expect(isCollapsed("Done")).toBe(true);
	});

	it("没有开启 collapsible 或列退出折叠时，折叠列表不起作用：列不会被藏起来又没有按钮可以展开", () => {
		renderBoard({ defaultCollapsedColumns: ["todo"] });
		expect(isCollapsed("Todo")).toBe(false);
		expect(
			body("Todo").querySelector(".v-kanban__column-body-inner")?.hasAttribute("inert"),
		).toBe(false);
		cleanup();

		renderBoard({
			collapsible: true,
			defaultCollapsedColumns: ["todo"],
			columns: [
				{ id: "todo", title: "Todo", collapsible: false },
				{ id: "doing", title: "Doing" },
				{ id: "done", title: "Done" },
			],
		});
		expect(isCollapsed("Todo")).toBe(false);
	});

	it("renderColumnHeader 返回 null 就不显示列头（不退回默认列头）", () => {
		renderBoard({ renderColumnHeader: () => null });

		expect(document.querySelectorAll(".v-kanban__column-header")).toHaveLength(0);
		expect(document.querySelectorAll(".v-kanban__column-title")).toHaveLength(0);
	});

	it("键盘把拿起的卡片挪进折叠的列时，该列先展开，卡片仍被拿着（折叠的列体不能聚焦）", () => {
		const onChange = vi.fn();
		renderBoard({
			collapsible: true,
			defaultCollapsedColumns: ["doing"],
			onCollapsedColumnsChange: onChange,
			onMove: () => {},
		});
		fireEvent.keyDown(card("a"), { key: "Enter" });
		expect(card("a").getAttribute("data-lifted")).toBe("true");

		fireEvent.keyDown(card("a"), { key: "ArrowRight" });

		expect(isCollapsed("Doing")).toBe(false);
		expect(onChange).toHaveBeenLastCalledWith([]);
		expect(card("a").getAttribute("data-lifted")).toBe("true");
	});

	it("折叠与展开算用户在操作：告知外层画布，不再随内容尺寸自动适应", () => {
		const { container } = renderBoard({ collapsible: true });
		const notified = vi.fn();
		container.addEventListener(EDITING_EVENT, notified);

		fireEvent.click(toggle("Todo"));

		expect(notified).toHaveBeenCalledTimes(1);
	});

	it("自定义列头时折叠按钮仍在，名称用列的标题", () => {
		renderBoard({
			collapsible: true,
			renderColumnHeader: (col, { count }) => <h3>{`${col.title} (${count})`}</h3>,
		});

		expect(within(column("Todo")).getByText("Todo (3)")).toBeTruthy();
		expect(toggle("Todo").getAttribute("aria-label")).toBe("Collapse Todo");
	});

	it("zh-CN 文案", () => {
		renderBoard({ collapsible: true, locale: "zh-CN" });

		expect(within(column("Todo")).getByRole("button", { name: "折叠 Todo" })).toBeTruthy();
	});
});
