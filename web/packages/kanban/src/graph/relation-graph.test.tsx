import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { BoardColumn } from "../board/board.tsx";
import { DEFAULT_GRAPH_LAYOUT, layoutGraph, type Relation, routeEdge } from "../core/index.ts";
import { RelationGraph, type RelationGraphProps } from "./relation-graph.tsx";

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
const order = { todo: ["a", "b", "c"], doing: ["d"], done: ["e"] };
const relations: Relation[] = [
	{ sourceId: "a", targetId: "d", type: "extends" },
	{ sourceId: "b", targetId: "d", type: "fixes" },
	{ sourceId: "e", targetId: "c", type: "blocks" },
	{ sourceId: "c", targetId: "a", type: "extends" },
];

type Props = Partial<RelationGraphProps<Task, BoardColumn>>;
const graph = (props: Props = {}) => (
	<RelationGraph
		columns={columns}
		cards={tasks}
		order={order}
		relations={relations}
		getCardLabel={(task) => task.title}
		renderCard={(task) => <span>{task.title}</span>}
		{...props}
	/>
);
const renderGraph = (props: Props = {}) => render(graph(props));

const card = (id: string) => document.querySelector(`[data-card-id="${id}"]`) as HTMLElement;
const column = (name: string) => screen.getByRole("group", { name });
const px = (value: string) => Number.parseFloat(value);
const lines = () => [...document.querySelectorAll<SVGGElement>(".v-kanban__relation")];
const cardIds = () =>
	[...document.querySelectorAll("[data-card-id]")].map((item) =>
		item.getAttribute("data-card-id"),
	);

/** 与组件同一份输入的排布，用来核对它按排布结果定位。 */
const expected = (overrides: Partial<Parameters<typeof layoutGraph>[0]> = {}) =>
	layoutGraph({
		columns: columns.map((item) => item.id),
		cards: Object.entries(order).flatMap(([columnId, ids]) =>
			ids.map((id) => ({ id, columnId })),
		),
		relations,
		...overrides,
	});

describe("按列分区的排布", () => {
	it("每列一个有名称的分组，卡片在自己的分组里，列头显示标题与数量", () => {
		renderGraph();

		expect(within(column("Planned")).getAllByRole("listitem")).toHaveLength(3);
		expect(within(column("In progress")).getAllByRole("listitem")).toHaveLength(1);
		expect(column("Done").contains(card("e"))).toBe(true);
		const headers = [...document.querySelectorAll(".v-kanban-graph__zone-header")];
		expect(headers.map((item) => item.textContent)).toEqual([
			"Planned3Cards: 3",
			"In progress1Cards: 1",
			"Done1Cards: 1",
		]);
	});

	it("分组的位置、卡片的位置与整体尺寸都来自 layoutGraph", () => {
		renderGraph();
		const layout = expected();

		const root = document.querySelector(".v-kanban-graph") as HTMLElement;
		expect(px(root.style.width)).toBe(layout.width);
		expect(px(root.style.height)).toBe(layout.height);
		for (const { id, rect } of layout.columns) {
			const group = document.querySelector(`[data-column-id="${id}"]`) as HTMLElement;
			expect([px(group.style.left), px(group.style.top)]).toEqual([rect.left, rect.top]);
			const zone = document.querySelector(`[data-zone-id="${id}"]`) as HTMLElement;
			expect([px(zone.style.left), px(zone.style.top)]).toEqual([rect.left, rect.top]);
		}
		for (const { id, columnId, rect } of layout.cards) {
			const origin = layout.columns.find((item) => item.id === columnId)?.rect;
			const element = card(id);
			expect(px(element.style.left)).toBe(rect.left - (origin?.left ?? 0));
			expect(px(element.style.top)).toBe(rect.top - (origin?.top ?? 0));
			expect(px(element.style.width)).toBe(rect.right - rect.left);
			expect(px(element.style.height)).toBe(rect.bottom - rect.top);
		}
	});

	it("列内的读屏顺序就是排布后从上到下的顺序", () => {
		const reversed = {
			columns: ["left", "right"],
			cards: [
				{ id: "a1", title: "A1" },
				{ id: "a2", title: "A2" },
				{ id: "b1", title: "B1" },
				{ id: "b2", title: "B2" },
			],
			order: { left: ["a1", "a2"], right: ["b1", "b2"] },
			relations: [
				{ sourceId: "a1", targetId: "b2", type: "extends" },
				{ sourceId: "a2", targetId: "b1", type: "extends" },
			],
		};
		renderGraph({ ...reversed, columns: reversed.columns.map((id) => ({ id })) });

		const layout = layoutGraph({
			columns: reversed.columns,
			cards: Object.entries(reversed.order).flatMap(([columnId, ids]) =>
				ids.map((id) => ({ id, columnId })),
			),
			relations: reversed.relations,
		});
		const left = layout.cards
			.filter((entry) => entry.columnId === "left")
			.sort((a, b) => a.rect.top - b.rect.top);
		expect(
			within(document.querySelector('[data-column-id="left"]') as HTMLElement)
				.getAllByRole("listitem")
				.map((item) => item.getAttribute("data-card-id")),
		).toEqual(left.map((entry) => entry.id));
	});

	it("cardSize 改变卡片与整体的尺寸", () => {
		renderGraph({ cardSize: { width: 180, height: 56 } });

		expect(px(card("a").style.width)).toBe(180);
		expect(px(card("a").style.height)).toBe(56);
		const layout = layoutGraph(
			{
				columns: columns.map((item) => item.id),
				cards: Object.entries(order).flatMap(([columnId, ids]) =>
					ids.map((id) => ({ id, columnId })),
				),
				relations,
			},
			{ cardWidth: 180, cardHeight: 56 },
		);
		expect(px((document.querySelector(".v-kanban-graph") as HTMLElement).style.width)).toBe(
			layout.width,
		);
	});

	it("renderCard 对每张卡片只调用一次，带着所在的列", () => {
		const renderCard = vi.fn((task: Task, _context: { column: BoardColumn }) => (
			<span>{task.title}</span>
		));

		renderGraph({ renderCard });

		expect(renderCard).toHaveBeenCalledTimes(5);
		expect(renderCard.mock.calls.find(([task]) => task.id === "d")?.[1]).toEqual({
			column: columns[1],
		});
	});

	it("不属于任何列的卡片与重复的 id 不显示", () => {
		renderGraph({ order: { todo: ["a", "a", "ghost"], doing: ["a", "d"], elsewhere: ["e"] } });

		expect(cardIds()).toEqual(["a", "d"]);
	});

	it("没有任何卡片时只显示提示，没有分区", () => {
		renderGraph({ cards: [] });

		expect(screen.getByText("Nothing to show")).toBeTruthy();
		expect(document.querySelector(".v-kanban-graph__zone")).toBeNull();
	});

	it("根节点是有名称的分组，其余 div 属性落在它上面，尺寸不会被行内样式覆盖", () => {
		renderGraph({ className: "mine", id: "graph", style: { width: 5, color: "red" } });

		const root = screen.getByRole("group", { name: "Relation graph" });
		expect(root.className).toBe("v-kanban v-kanban-graph mine");
		expect(root.id).toBe("graph");
		expect(root.style.color).toBe("red");
		expect(px(root.style.width)).toBe(expected().width);
	});
});

describe("关系线", () => {
	it("每条两端都在图里的关系画一条线，线按排布的矩形连接", () => {
		renderGraph({
			relations: [...relations, { sourceId: "a", targetId: "ghost", type: "extends" }],
		});
		const layout = expected();

		expect(lines()).toHaveLength(4);
		for (const relation of relations) {
			const group = document.querySelector(
				`.v-kanban__relation[data-source="${relation.sourceId}"][data-target="${relation.targetId}"]`,
			);
			const from = layout.cards.find((entry) => entry.id === relation.sourceId)?.rect;
			const to = layout.cards.find((entry) => entry.id === relation.targetId)?.rect;
			if (!from || !to) throw new Error("missing rect");
			expect(group?.querySelector("path.v-kanban__relation-line")?.getAttribute("d")).toBe(
				routeEdge(from, to).d,
			);
		}
	});

	it("线型随类型：阻塞带挡条，其余带箭头", () => {
		renderGraph();

		const blocker = document.querySelector('.v-kanban__relation[data-relation-type="blocks"]');
		expect(blocker?.querySelector(".v-kanban__relation-bar")).not.toBeNull();
		const extend = document.querySelector('.v-kanban__relation[data-relation-type="extends"]');
		expect(extend?.querySelector(".v-kanban__relation-head")).not.toBeNull();
	});

	it("线叠加层不接收指针，对读屏隐藏", () => {
		renderGraph();

		const layer = document.querySelector(".v-kanban__relations") as SVGElement;
		expect(layer.getAttribute("aria-hidden")).toBe("true");
		expect(layer.style.pointerEvents).toBe("none");
	});

	it("每张有关系的卡片带给读屏的文字描述，没有关系的卡片没有", () => {
		renderGraph({
			relations: [
				{ sourceId: "a", targetId: "d", type: "extends" },
				{ sourceId: "e", targetId: "a", type: "blocks" },
			],
		});

		expect(card("a").textContent).toContain("Relations: extends Task D; is blocked by Task E");
		expect(card("b").querySelector(".v-kanban__sr-only")).toBeNull();
	});

	it("类型表可以覆盖读法，中文文案", () => {
		renderGraph({
			locale: "zh-CN",
			relations: [{ sourceId: "a", targetId: "d", type: "relates" }],
			relationTypes: { relates: { label: "关联", inverseLabel: "被关联", line: "dashed" } },
		});

		expect(card("a").textContent).toContain("关系：关联 Task D");
		expect(card("d").textContent).toContain("关系：被关联 Task A");
		expect(screen.getByRole("group", { name: "关系图" })).toBeTruthy();
	});
});

describe("相关子图", () => {
	it("给了 rootId 只显示根及其相关的卡片与关系，根有标记", () => {
		renderGraph({ rootId: "c" });

		// c 连着 e（阻塞 c）与 a（c 扩展 a），a 连着 d，d 连着 b
		expect(cardIds().sort()).toEqual(["a", "b", "c", "d", "e"]);
		document.body.innerHTML = "";

		renderGraph({ rootId: "c", subgraph: { depth: 1 } });
		expect(cardIds().sort()).toEqual(["a", "c", "e"]);
		expect(lines()).toHaveLength(2);
		expect(card("c").getAttribute("data-root")).toBe("true");
		expect(card("a").hasAttribute("data-root")).toBe(false);
	});

	it("subgraph 限定方向与类型", () => {
		renderGraph({ rootId: "d", subgraph: { direction: "in", types: ["extends"] } });

		expect(cardIds().sort()).toEqual(["a", "c", "d"]);
		expect(lines().map((item) => item.getAttribute("data-relation-type"))).toEqual([
			"extends",
			"extends",
		]);
	});

	it("子图里空的分区仍然显示，卡片按子图重新排布", () => {
		renderGraph({ rootId: "a", subgraph: { depth: 0 } });

		expect(cardIds()).toEqual(["a"]);
		expect(screen.getAllByRole("group", { name: /Planned|In progress|Done/ })).toHaveLength(3);
		expect(lines()).toHaveLength(0);
	});

	it("根不在图里时什么也不显示", () => {
		renderGraph({ rootId: "ghost" });

		expect(cardIds()).toEqual([]);
		expect(screen.getByText("Nothing to show")).toBeTruthy();
	});
});

describe("选中", () => {
	it("没有 onSelectedCardChange 时不可聚焦、不可选中", () => {
		renderGraph();

		expect(card("a").hasAttribute("tabindex")).toBe(false);
		fireEvent.click(card("a"));
		expect(card("a").hasAttribute("data-selected")).toBe(false);
	});

	it("点击卡片通知选中，再点一次通知取消，点空白处取消", () => {
		const onSelectedCardChange = vi.fn();
		const view = renderGraph({ onSelectedCardChange });

		fireEvent.click(card("a"));
		expect(onSelectedCardChange).toHaveBeenLastCalledWith("a");

		view.rerender(graph({ onSelectedCardChange, selectedCardId: "a" }));
		fireEvent.click(card("a"));
		expect(onSelectedCardChange).toHaveBeenLastCalledWith(null);
		fireEvent.click(document.querySelector(".v-kanban-graph") as HTMLElement);
		expect(onSelectedCardChange).toHaveBeenLastCalledWith(null);
		fireEvent.click(column("Planned"));
		expect(onSelectedCardChange).toHaveBeenCalledTimes(4);
	});

	it("选中的卡片与相邻卡片保持清晰，其余与不相关的线淡化", () => {
		renderGraph({ onSelectedCardChange: () => {}, selectedCardId: "a" });

		// a 连着 d（a 扩展 d）与 c（c 扩展 a）
		expect(card("a").getAttribute("data-selected")).toBe("true");
		expect(card("a").getAttribute("aria-current")).toBe("true");
		expect(card("d").getAttribute("data-related")).toBe("true");
		expect(card("c").getAttribute("data-related")).toBe("true");
		expect(card("b").getAttribute("data-faded")).toBe("true");
		expect(card("e").getAttribute("data-faded")).toBe("true");
		const states = Object.fromEntries(
			lines().map((item) => [
				`${item.getAttribute("data-source")}>${item.getAttribute("data-target")}`,
				item.getAttribute("data-state"),
			]),
		);
		expect(states).toEqual({
			"a>d": "active",
			"c>a": "active",
			"b>d": "faded",
			"e>c": "faded",
		});
	});

	it("不在图里的选中 id 等于没有选中", () => {
		renderGraph({ onSelectedCardChange: () => {}, selectedCardId: "ghost" });

		expect(document.querySelector("[data-faded]")).toBeNull();
	});

	it("可聚焦，Enter 与空格选中，带修饰键的不算", () => {
		const onSelectedCardChange = vi.fn();
		renderGraph({ onSelectedCardChange });

		expect(card("a").getAttribute("tabindex")).toBe("0");
		fireEvent.keyDown(card("a"), { key: "Enter" });
		fireEvent.keyDown(card("b"), { key: " " });
		fireEvent.keyDown(card("c"), { key: "Enter", ctrlKey: true });
		fireEvent.keyDown(card("c"), { key: "a" });

		expect(onSelectedCardChange.mock.calls).toEqual([["a"], ["b"]]);
	});

	it("卡片里的按钮自己处理点击，不算选中；卡片里的键盘事件也不算", () => {
		const onSelectedCardChange = vi.fn();
		const onOpen = vi.fn();
		renderGraph({
			onSelectedCardChange,
			renderCard: (task) => (
				<button type="button" onClick={() => onOpen(task.id)}>
					open {task.id}
				</button>
			),
		});

		fireEvent.click(screen.getByRole("button", { name: "open a" }));
		fireEvent.keyDown(screen.getByRole("button", { name: "open a" }), { key: "Enter" });

		expect(onOpen).toHaveBeenCalledExactlyOnceWith("a");
		expect(onSelectedCardChange).not.toHaveBeenCalled();
	});

	it("键盘说明与卡片关联", () => {
		renderGraph({ onSelectedCardChange: () => {} });

		const hint = document.getElementById(card("a").getAttribute("aria-describedby") ?? "");
		expect(hint?.textContent).toBe(
			"Press Enter or Space to select this card and highlight its relations.",
		);
	});
});

describe("服务端渲染与规模", () => {
	it("输出确定，水合不报错", async () => {
		const tree = graph({ onSelectedCardChange: () => {} });
		const html = renderToString(tree);
		expect(renderToString(tree)).toBe(html);
		expect(html.indexOf("Planned")).toBeLessThan(html.indexOf("Done"));
		const container = document.createElement("div");
		container.innerHTML = html;
		document.body.append(container);
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});
		const recoverable = vi.fn();

		await act(async () => {
			hydrateRoot(container, tree, { onRecoverableError: recoverable });
		});

		expect(errors).not.toHaveBeenCalled();
		expect(recoverable).not.toHaveBeenCalled();
		errors.mockRestore();
		container.remove();
	});

	it("卡片很多时仍能渲染：400 张卡片、600 条关系", () => {
		const names = ["c0", "c1", "c2", "c3"];
		const many = Array.from({ length: 400 }, (_, index) => ({
			id: `n${index}`,
			title: `Node ${index}`,
		}));
		const manyOrder = Object.fromEntries(
			names.map((name, at) => [
				name,
				many.filter((_, index) => index % 4 === at).map((item) => item.id),
			]),
		);
		const links: Relation[] = Array.from({ length: 600 }, (_, index) => ({
			sourceId: `n${(index * 7) % 400}`,
			targetId: `n${(index * 11 + 3) % 400}`,
			type: ["extends", "fixes", "blocks"][index % 3],
		}));

		const started = performance.now();
		renderGraph({
			columns: names.map((id) => ({ id })),
			cards: many,
			order: manyOrder,
			relations: links,
			onSelectedCardChange: () => {},
		});
		const elapsed = performance.now() - started;

		expect(cardIds()).toHaveLength(400);
		expect(lines().length).toBeGreaterThan(500);
		expect(elapsed).toBeLessThan(8000);
		expect(DEFAULT_GRAPH_LAYOUT.headerHeight).toBeGreaterThan(0);
	});
});
