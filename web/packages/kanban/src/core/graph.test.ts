// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
	DEFAULT_GRAPH_LAYOUT,
	type GraphCard,
	type GraphLayout,
	layoutGraph,
	relatedSubgraph,
} from "./graph.ts";
import type { Rect } from "./moves.ts";
import type { Relation } from "./relations.ts";

const card = (id: string, columnId: string, size: Partial<GraphCard> = {}): GraphCard => ({
	id,
	columnId,
	...size,
});
const rel = (sourceId: string, targetId: string, type = "extends"): Relation => ({
	sourceId,
	targetId,
	type,
});
const rectOf = (layout: GraphLayout, id: string) =>
	layout.cards.find((entry) => entry.id === id)?.rect as Rect;
const idsIn = (layout: GraphLayout, columnId: string) =>
	layout.cards
		.filter((entry) => entry.columnId === columnId)
		.sort((a, b) => a.rect.top - b.rect.top)
		.map((entry) => entry.id);

/** 两条跨列的线交叉：端点顺序相反。 */
function crossings(layout: GraphLayout, relations: readonly Relation[]) {
	const edges = relations.flatMap((relation) => {
		const from = layout.cards.find((entry) => entry.id === relation.sourceId);
		const to = layout.cards.find((entry) => entry.id === relation.targetId);
		return from && to && from.columnId !== to.columnId
			? [{ from: from.rect.top, to: to.rect.top, left: from.rect.left < to.rect.left }]
			: [];
	});
	let count = 0;
	for (const [index, a] of edges.entries())
		for (const b of edges.slice(index + 1))
			if (a.left === b.left && (a.from - b.from) * (a.to - b.to) < 0) count += 1;
	return count;
}

describe("layoutGraph", () => {
	const columns = ["todo", "doing", "done"];
	const cards = [
		card("a", "todo"),
		card("b", "todo"),
		card("c", "doing"),
		card("d", "done"),
		card("e", "done"),
	];
	const relations = [rel("a", "c"), rel("b", "d"), rel("e", "c", "blocks")];

	it("同一份输入总得到同一份结果，不受先前调用影响", () => {
		const first = layoutGraph({ columns, cards, relations });
		layoutGraph({ columns: ["x"], cards: [card("z", "x")], relations: [] });
		const second = layoutGraph({ columns, cards, relations });

		expect(second).toEqual(first);
		expect(JSON.stringify(second)).toBe(JSON.stringify(first));
	});

	it("不修改输入", () => {
		const input = {
			columns: [...columns],
			cards: cards.map((item) => ({ ...item })),
			relations: relations.map((item) => ({ ...item })),
		};
		const snapshot = JSON.stringify(input);

		layoutGraph(input);

		expect(JSON.stringify(input)).toBe(snapshot);
	});

	it("列从左到右按给定顺序排布，相邻列相隔 columnGap，所有列等高", () => {
		const layout = layoutGraph({ columns, cards, relations }, { columnGap: 80 });

		expect(layout.columns.map((entry) => entry.id)).toEqual(columns);
		const [first, second, third] = layout.columns.map((entry) => entry.rect);
		expect(second.left - first.right).toBe(80);
		expect(third.left - second.right).toBe(80);
		expect(
			new Set(layout.columns.map((entry) => entry.rect.bottom - entry.rect.top)).size,
		).toBe(1);
		expect(layout.width).toBe(third.right);
		expect(layout.height).toBe(first.bottom);
	});

	it("卡片在自己列的内边距之内，列头下面，列内互不重叠且相隔 cardGap", () => {
		const layout = layoutGraph({ columns, cards, relations });
		const d = DEFAULT_GRAPH_LAYOUT;

		for (const entry of layout.cards) {
			const column = layout.columns.find((item) => item.id === entry.columnId)?.rect as Rect;
			expect(entry.rect.left).toBe(column.left + d.columnPaddingX);
			expect(entry.rect.right).toBe(entry.rect.left + d.cardWidth);
			expect(entry.rect.top).toBeGreaterThanOrEqual(d.headerHeight + d.columnPaddingY);
			expect(entry.rect.bottom).toBeLessThanOrEqual(column.bottom - d.columnPaddingY);
		}
		const [upper, lower] = idsIn(layout, "todo").map((id) => rectOf(layout, id));
		expect(lower.top - upper.bottom).toBe(d.cardGap);
	});

	it("跨列关系的邻居位置决定列内顺序，消除可以消除的交叉", () => {
		const crossing = {
			columns: ["left", "right"],
			cards: [
				card("a1", "left"),
				card("a2", "left"),
				card("b1", "right"),
				card("b2", "right"),
			],
			relations: [rel("a1", "b2"), rel("a2", "b1")],
		};

		const naive = layoutGraph(crossing, { sweeps: 0 });
		const sorted = layoutGraph(crossing);

		expect(crossings(naive, crossing.relations)).toBe(1);
		expect(crossings(sorted, crossing.relations)).toBe(0);
	});

	it("线很多时交叉比输入顺序少", () => {
		const columns = ["c0", "c1", "c2"];
		const cards = columns.flatMap((column) =>
			Array.from({ length: 8 }, (_, index) => card(`${column}-${index}`, column)),
		);
		// 每张卡片连向下一列里「反着数」的那张：输入顺序下处处交叉
		const links = ["c0", "c1"].flatMap((column, at) =>
			Array.from({ length: 8 }, (_, index) =>
				rel(`${column}-${index}`, `c${at + 1}-${7 - index}`),
			),
		);

		const naive = layoutGraph({ columns, cards, relations: links }, { sweeps: 0 });
		const sorted = layoutGraph({ columns, cards, relations: links });

		expect(crossings(naive, links)).toBeGreaterThan(20);
		expect(crossings(sorted, links)).toBe(0);
	});

	it("sweeps 为 0 时保持输入顺序", () => {
		const layout = layoutGraph({ columns, cards, relations }, { sweeps: 0 });

		expect(idsIn(layout, "todo")).toEqual(["a", "b"]);
		expect(idsIn(layout, "done")).toEqual(["d", "e"]);
	});

	it("没有跨列关系的卡片保持输入顺序；同一列内的关系不参与排序", () => {
		const layout = layoutGraph({
			columns: ["todo"],
			cards: [card("a", "todo"), card("b", "todo"), card("c", "todo")],
			relations: [rel("c", "a"), rel("b", "c")],
		});

		expect(idsIn(layout, "todo")).toEqual(["a", "b", "c"]);
	});

	it("忽略不属于任何列的卡片与重复的 id，以及指向它们的关系", () => {
		const layout = layoutGraph({
			columns: ["todo", "todo", "done"],
			cards: [
				card("a", "todo"),
				card("a", "done"),
				card("ghost", "nowhere"),
				card("b", "done"),
			],
			relations: [rel("a", "ghost"), rel("a", "b"), rel("a", "missing")],
		});

		expect(layout.columns.map((entry) => entry.id)).toEqual(["todo", "done"]);
		expect(layout.cards.map((entry) => [entry.id, entry.columnId])).toEqual([
			["a", "todo"],
			["b", "done"],
		]);
	});

	it("单张卡片的尺寸改变列宽与堆叠", () => {
		const layout = layoutGraph(
			{
				columns: ["todo", "done"],
				cards: [
					card("a", "todo", { width: 300, height: 100 }),
					card("b", "todo"),
					card("c", "done"),
				],
				relations: [],
			},
			{ sweeps: 0 },
		);
		const d = DEFAULT_GRAPH_LAYOUT;

		const [todo, done] = layout.columns.map((entry) => entry.rect);
		expect(todo.right - todo.left).toBe(300 + d.columnPaddingX * 2);
		expect(done.right - done.left).toBe(d.cardWidth + d.columnPaddingX * 2);
		const a = rectOf(layout, "a");
		expect(a.bottom - a.top).toBe(100);
		expect(rectOf(layout, "b").top - a.bottom).toBe(d.cardGap);
	});

	it("空的列仍然是一个分区；没有任何列时尺寸为 0", () => {
		const empty = layoutGraph({ columns: ["todo", "done"], cards: [], relations: [] });

		expect(empty.columns).toHaveLength(2);
		expect(empty.cards).toEqual([]);
		expect(empty.width).toBeGreaterThan(0);
		expect(empty.height).toBeGreaterThan(0);
		expect(layoutGraph({ columns: [], cards: [], relations: [] })).toEqual({
			columns: [],
			cards: [],
			width: 0,
			height: 0,
		});
	});

	it("非法的尺寸参数回落到默认值", () => {
		const layout = layoutGraph(
			{
				columns: ["todo"],
				cards: [card("a", "todo", { width: -5, height: Number.NaN })],
				relations: [],
			},
			{ cardWidth: 0, cardGap: -1, sweeps: Number.NaN },
		);

		expect(rectOf(layout, "a").right - rectOf(layout, "a").left).toBe(
			DEFAULT_GRAPH_LAYOUT.cardWidth,
		);
		expect(rectOf(layout, "a").bottom - rectOf(layout, "a").top).toBe(
			DEFAULT_GRAPH_LAYOUT.cardHeight,
		);
	});

	it("数据里已有的环、重复与自指关系不会让它停不下来", () => {
		const layout = layoutGraph({
			columns: ["a", "b"],
			cards: [card("x", "a"), card("y", "b")],
			relations: [rel("x", "y"), rel("y", "x"), rel("x", "y"), rel("x", "x")],
		});

		expect(layout.cards).toHaveLength(2);
	});

	it("卡片很多时仍然很快：1200 张卡片、1800 条关系", () => {
		const names = ["todo", "doing", "done"];
		const many = Array.from({ length: 1200 }, (_, index) =>
			card(`c${index}`, names[index % 3]),
		);
		const links = Array.from({ length: 1800 }, (_, index) =>
			rel(
				`c${(index * 7) % 1200}`,
				`c${(index * 13 + 5) % 1200}`,
				index % 2 ? "extends" : "fixes",
			),
		);

		const started = performance.now();
		const layout = layoutGraph({ columns: names, cards: many, relations: links });
		const elapsed = performance.now() - started;

		expect(layout.cards).toHaveLength(1200);
		expect(elapsed).toBeLessThan(2000);
	});
});

describe("relatedSubgraph", () => {
	//   root ← a ← b      root ← c      root → up      d ⟂ e（与根无关）
	const relations = [
		rel("a", "root"),
		rel("b", "a"),
		rel("c", "root", "fixes"),
		rel("root", "up", "blocks"),
		rel("d", "e"),
	];

	it("默认不分方向：根所在的连通部分，根在最前，其余按步数与关系顺序", () => {
		const graph = relatedSubgraph(relations, "root");

		expect(graph.ids).toEqual(["root", "a", "c", "up", "b"]);
		expect(graph.relations).toEqual(relations.slice(0, 4));
	});

	it("in 沿指向根的方向走：扩展根的子卡片，不含根指向的", () => {
		const graph = relatedSubgraph(relations, "root", { direction: "in" });

		expect(graph.ids).toEqual(["root", "a", "c", "b"]);
		expect(graph.relations.map((item) => item.type)).toEqual(["extends", "extends", "fixes"]);
	});

	it("out 沿根指向的方向走", () => {
		expect(relatedSubgraph(relations, "root", { direction: "out" }).ids).toEqual([
			"root",
			"up",
		]);
		expect(relatedSubgraph(relations, "b", { direction: "out" }).ids).toEqual([
			"b",
			"a",
			"root",
			"up",
		]);
	});

	it("depth 限制离根的步数，0 只有根自己", () => {
		expect(relatedSubgraph(relations, "root", { depth: 1 }).ids).toEqual([
			"root",
			"a",
			"c",
			"up",
		]);
		const only = relatedSubgraph(relations, "root", { depth: 0 });
		expect(only.ids).toEqual(["root"]);
		expect(only.relations).toEqual([]);
	});

	it("types 同时限制找路与结果", () => {
		const graph = relatedSubgraph(relations, "root", { types: ["extends"] });

		expect(graph.ids).toEqual(["root", "a", "b"]);
		expect(graph.relations.every((item) => item.type === "extends")).toBe(true);
	});

	it("结果里的关系是两端都在子图里的全部关系，包括没被走过的那条", () => {
		const triangle = [rel("a", "root"), rel("b", "root"), rel("a", "b")];

		const graph = relatedSubgraph(triangle, "root", { direction: "in", depth: 1 });

		expect(graph.ids).toEqual(["root", "a", "b"]);
		expect(graph.relations).toEqual(triangle);
	});

	it("根不在任何关系里：只有它自己", () => {
		expect(relatedSubgraph(relations, "lonely")).toEqual({ ids: ["lonely"], relations: [] });
	});

	it("环、重复与自指关系不会让它停不下来，自指不进结果", () => {
		const graph = relatedSubgraph(
			[rel("a", "b"), rel("b", "a"), rel("a", "b"), rel("a", "a")],
			"a",
		);

		expect(graph.ids).toEqual(["a", "b"]);
		expect(graph.relations).toHaveLength(3);
	});

	it("不修改输入，同一份输入同一份结果", () => {
		const snapshot = JSON.stringify(relations);

		const first = relatedSubgraph(relations, "root");
		const second = relatedSubgraph(relations, "root");

		expect(JSON.stringify(relations)).toBe(snapshot);
		expect(second).toEqual(first);
	});

	it("非法的 depth 当作不限", () => {
		expect(relatedSubgraph(relations, "root", { depth: Number.NaN }).ids).toHaveLength(5);
		expect(relatedSubgraph(relations, "root", { depth: -3 }).ids).toEqual(["root"]);
	});
});
