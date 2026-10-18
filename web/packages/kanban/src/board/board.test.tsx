import { act, cleanup, render, screen, within } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Board } from "./board.tsx";

interface Task {
	id: string;
	title: string;
}

const tasks: Task[] = [
	{ id: "t1", title: "写规格" },
	{ id: "t2", title: "做原型" },
	{ id: "t3", title: "上线" },
];

const columns = [
	{ id: "todo", title: "规划中" },
	{ id: "doing", title: "开发中" },
];

describe("Board", () => {
	it("按使用方给出的列顺序与列内顺序渲染，卡片内容由 renderCard 决定", () => {
		render(
			<Board
				columns={columns}
				cards={tasks}
				order={{ todo: ["t3", "t1"], doing: ["t2"] }}
				renderCard={(task) => <span>{task.title}</span>}
			/>,
		);

		const regions = within(screen.getByRole("group", { name: "Kanban board" })).getAllByRole(
			"group",
		);
		expect(regions.map((region) => region.getAttribute("aria-label"))).toEqual([
			"规划中",
			"开发中",
		]);
		const [todo, doing] = regions.map((region) => within(region).queryAllByRole("listitem"));
		expect(todo.map((item) => item.textContent)).toEqual(["上线", "写规格"]);
		expect(doing.map((item) => item.textContent)).toEqual(["做原型"]);
	});

	describe("默认列头与空状态", () => {
		const renderBoard = (props: Partial<Parameters<typeof Board<Task>>[0]> = {}) =>
			render(
				<Board
					columns={columns}
					cards={tasks}
					order={{ todo: ["t1", "t2"], doing: [] }}
					renderCard={(task) => <span>{task.title}</span>}
					{...props}
				/>,
			);

		it("列头显示标题与卡片数，读屏得到完整的数量描述", () => {
			renderBoard();

			const todo = screen.getByRole("group", { name: "规划中" });
			expect(within(todo).getByRole("heading", { name: "规划中" })).toBeTruthy();
			expect(within(todo).getByText("Cards: 2")).toBeTruthy();
		});

		it("没有标题的列用 id 作为标题与可访问名称", () => {
			renderBoard({ columns: [{ id: "backlog" }], order: { backlog: [] } });

			expect(screen.getByRole("group", { name: "backlog" })).toBeTruthy();
		});

		it("空列显示空状态而不是空列表", () => {
			renderBoard();

			const doing = screen.getByRole("group", { name: "开发中" });
			expect(within(doing).getByText("No cards")).toBeTruthy();
			expect(within(doing).queryByRole("list")).toBeNull();
		});

		it("每列是带名称的分组而不是地标，卡片列表显式声明 list 角色", () => {
			const { container } = renderBoard();

			expect(screen.queryAllByRole("region")).toHaveLength(0);
			expect(screen.queryAllByRole("navigation")).toHaveLength(0);
			expect(container.querySelector("ul")?.getAttribute("role")).toBe("list");
		});

		it("默认英文，locale 切到 zh-CN 得到内置中文", () => {
			renderBoard();
			expect(screen.getByRole("group", { name: "Kanban board" })).toBeTruthy();
			cleanup();

			renderBoard({ locale: "zh-CN" });
			expect(screen.getByRole("group", { name: "看板" })).toBeTruthy();
			const doing = screen.getByRole("group", { name: "开发中" });
			expect(within(doing).getByText("暂无卡片")).toBeTruthy();
			expect(within(doing).getByText("卡片数：0")).toBeTruthy();
		});

		it("messages 只覆盖给出的键，覆盖文案按纯文本呈现", () => {
			renderBoard({
				messages: { emptyColumn: "<b>Nothing</b> here", cardCount: "{count} items" },
			});

			const doing = screen.getByRole("group", { name: "开发中" });
			expect(within(doing).getByText("<b>Nothing</b> here")).toBeTruthy();
			expect(within(doing).getByText("0 items")).toBeTruthy();
			expect(screen.getByRole("group", { name: "Kanban board" })).toBeTruthy();
		});
	});

	describe("插槽", () => {
		it("renderCard 拿到所在列与列内序号", () => {
			const seen: Array<[string, string, number]> = [];
			render(
				<Board
					columns={columns}
					cards={tasks}
					order={{ todo: ["t1", "t2"], doing: ["t3"] }}
					renderCard={(task, { column, index }) => {
						seen.push([task.id, column.id, index]);
						return task.title;
					}}
				/>,
			);

			expect(seen).toEqual([
				["t1", "todo", 0],
				["t2", "todo", 1],
				["t3", "doing", 0],
			]);
		});

		it("renderColumnHeader 取代默认列头，并拿到使用方自己的列类型与卡片数", () => {
			interface Stage {
				id: string;
				title: string;
				hint: string;
			}
			const stages: Stage[] = [{ id: "todo", title: "规划中", hint: "还没开始" }];
			render(
				<Board
					columns={stages}
					cards={tasks}
					order={{ todo: ["t1", "t2"] }}
					renderCard={(task) => task.title}
					renderColumnHeader={(stage, { count }) => (
						<div data-testid="header">{`${stage.hint}/${count}`}</div>
					)}
				/>,
			);

			expect(screen.getByTestId("header").textContent).toBe("还没开始/2");
			expect(screen.queryByRole("heading")).toBeNull();
			expect(screen.getByRole("group", { name: "规划中" })).toBeTruthy();
		});

		it("renderEmpty 返回 null 时不显示任何空状态", () => {
			render(
				<Board
					columns={columns}
					cards={tasks}
					order={{ todo: [], doing: [] }}
					renderCard={(task) => task.title}
					renderEmpty={() => null}
				/>,
			);

			expect(screen.queryByText("No cards")).toBeNull();
		});

		it("renderEmpty 取代默认空状态，非空列不调用", () => {
			render(
				<Board
					columns={columns}
					cards={tasks}
					order={{ todo: ["t1"], doing: [] }}
					renderCard={(task) => task.title}
					renderEmpty={(column) => <em>{`${column.id} 没有内容`}</em>}
				/>,
			);

			expect(screen.getAllByText(/没有内容/).map((node) => node.textContent)).toEqual([
				"doing 没有内容",
			]);
			expect(screen.queryByText("No cards")).toBeNull();
		});
	});

	describe("只读与健壮性", () => {
		it("自身不提供任何可交互控件、拖拽属性或可聚焦元素", () => {
			const { container } = render(
				<Board
					columns={columns}
					cards={tasks}
					order={{ todo: ["t1"], doing: ["t2"] }}
					renderCard={(task) => <span>{task.title}</span>}
				/>,
			);

			expect(
				container.querySelectorAll(
					"button, a, input, select, textarea, [tabindex], [draggable]",
				),
			).toHaveLength(0);
		});

		it("列或卡片 id 重复、引用不存在的卡片时不报 key 告警，重复项只渲染一次", () => {
			const errors = vi.spyOn(console, "error").mockImplementation(() => {});
			render(
				<Board
					columns={[...columns, columns[0]]}
					cards={tasks}
					order={{ todo: ["t1", "t1", "ghost"], doing: ["t1", "t2"] }}
					renderCard={(task) => <span>{task.title}</span>}
				/>,
			);

			expect(errors).not.toHaveBeenCalled();
			errors.mockRestore();
			expect(
				within(screen.getByRole("group", { name: "Kanban board" })).getAllByRole("group"),
			).toHaveLength(2);
			expect(screen.getAllByText("写规格")).toHaveLength(1);
			expect(screen.getAllByText("做原型")).toHaveLength(1);
		});

		it("className 与其余属性落在根节点，显式 aria-label 优先于内置文案", () => {
			render(
				<Board
					columns={columns}
					cards={tasks}
					order={{}}
					renderCard={(task) => task.title}
					className="mine"
					data-testid="root"
					aria-label="路线图"
				/>,
			);

			const root = screen.getByTestId("root");
			expect(root.className).toBe("v-kanban mine");
			expect(root.getAttribute("aria-label")).toBe("路线图");
		});
	});

	it("服务端渲染的标记可以直接水合，没有告警与恢复性错误", async () => {
		const board = (
			<Board
				columns={columns}
				cards={tasks}
				order={{ todo: ["t1"], doing: [] }}
				renderCard={(task) => <span>{task.title}</span>}
				locale="zh-CN"
			/>
		);
		const container = document.createElement("div");
		container.innerHTML = renderToString(board);
		document.body.append(container);
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});
		const recoverable = vi.fn();

		await act(async () => {
			hydrateRoot(container, board, { onRecoverableError: recoverable });
		});

		expect(errors).not.toHaveBeenCalled();
		expect(recoverable).not.toHaveBeenCalled();
		errors.mockRestore();
		container.remove();
	});
});
