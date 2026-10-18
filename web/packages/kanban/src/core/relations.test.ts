import { describe, expect, it } from "vitest";
import {
	arrowHead,
	blockerBar,
	checkRelation,
	createAdjacency,
	type Relation,
	routeEdge,
} from "./relations.ts";

const edge = (sourceId: string, targetId: string, type = "extends"): Relation => ({
	sourceId,
	targetId,
	type,
});

describe("checkRelation", () => {
	it("合法的关系通过", () => {
		expect(checkRelation([edge("a", "b")], edge("b", "c"))).toEqual({ ok: true });
		expect(checkRelation([], edge("a", "b"))).toEqual({ ok: true });
	});

	it("指向自身被拒绝", () => {
		expect(checkRelation([], edge("a", "a"))).toEqual({ ok: false, reason: "self" });
	});

	it("同一来源、目标与类型的关系已存在被拒绝；类型不同则不算重复", () => {
		const existing = [edge("a", "b", "extends")];

		expect(checkRelation(existing, edge("a", "b", "extends"))).toEqual({
			ok: false,
			reason: "duplicate",
		});
		expect(checkRelation(existing, edge("a", "b", "blocks"))).toEqual({ ok: true });
		// 反方向不是重复，但同类型会成环
		expect(checkRelation(existing, edge("b", "a", "extends")).ok).toBe(false);
	});

	it("同一类型内成环被拒绝，并给出环上的路径（从目标走回来源）", () => {
		const existing = [edge("a", "b"), edge("b", "c"), edge("c", "d")];

		expect(checkRelation(existing, edge("d", "a"))).toEqual({
			ok: false,
			reason: "cycle",
			path: ["a", "b", "c", "d"],
		});
		expect(checkRelation(existing, edge("c", "a"))).toEqual({
			ok: false,
			reason: "cycle",
			path: ["a", "b", "c"],
		});
	});

	it("环检测按类型分别进行：别的类型的边不构成环", () => {
		// 扩展 a→b、阻塞 b→a：方向语义相反，不是环
		const existing = [edge("a", "b", "extends")];

		expect(checkRelation(existing, edge("b", "a", "blocks"))).toEqual({ ok: true });
		// 不同类型的边拼起来也不算同一条路
		const mixed = [edge("a", "b", "extends"), edge("b", "c", "blocks")];
		expect(checkRelation(mixed, edge("c", "a", "extends"))).toEqual({ ok: true });
		expect(checkRelation(mixed, edge("c", "a", "blocks"))).toEqual({ ok: true });
	});

	it("菱形（多前置、多后继）不是环", () => {
		const diamond = [edge("a", "b"), edge("a", "c"), edge("b", "d"), edge("c", "d")];

		expect(checkRelation(diamond, edge("a", "d"))).toEqual({ ok: true });
	});

	it("数据里已有的环不会让检测死循环", () => {
		const broken = [edge("a", "b"), edge("b", "a")];

		expect(checkRelation(broken, edge("x", "a")).ok).toBe(true);
		expect(checkRelation(broken, edge("b", "x")).ok).toBe(true);
	});
});

describe("createAdjacency", () => {
	const relations = [
		edge("a", "b", "extends"),
		edge("a", "c", "blocks"),
		edge("d", "a", "fixes"),
		edge("b", "c", "extends"),
	];
	const graph = createAdjacency(relations);

	it("出边与入边，可按类型过滤，保持输入顺序", () => {
		expect(graph.outgoing("a").map((r) => r.targetId)).toEqual(["b", "c"]);
		expect(graph.outgoing("a", "blocks").map((r) => r.targetId)).toEqual(["c"]);
		expect(graph.incoming("c").map((r) => r.sourceId)).toEqual(["a", "b"]);
		expect(graph.incoming("c", "extends").map((r) => r.sourceId)).toEqual(["b"]);
		expect(graph.outgoing("zzz")).toEqual([]);
		expect(graph.incoming("d")).toEqual([]);
	});

	it("与某张卡片相连的所有关系，不分方向", () => {
		expect(graph.of("a")).toEqual([relations[0], relations[1], relations[2]]);
		expect(graph.of("c")).toEqual([relations[1], relations[3]]);
	});

	it("直接相邻的卡片，去重、不含自己", () => {
		expect(graph.neighbors("a")).toEqual(["b", "c", "d"]);
		expect(graph.neighbors("c")).toEqual(["a", "b"]);
		expect(
			createAdjacency([edge("a", "a"), edge("a", "b"), edge("a", "b", "blocks")]).neighbors(
				"a",
			),
		).toEqual(["b"]);
	});

	it("保留关系上的额外字段", () => {
		const rich = createAdjacency([{ ...edge("a", "b"), id: "r1" }]);

		expect(rich.outgoing("a")[0].id).toBe("r1");
	});
});

describe("routeEdge", () => {
	const rect = (left: number, top: number, width = 100, height = 40) => ({
		left,
		top,
		right: left + width,
		bottom: top + height,
	});

	it("目标在右边：从来源右缘中点到目标左缘中点，水平进出", () => {
		const route = routeEdge(rect(0, 0), rect(300, 100));

		expect(route.start).toEqual({ x: 100, y: 20 });
		expect(route.end).toEqual({ x: 300, y: 120 });
		expect(route.d.startsWith("M 100 20 C")).toBe(true);
		expect(route.d.endsWith("300 120")).toBe(true);
		expect(route.angle).toBeCloseTo(0, 6);
	});

	it("目标在左边：从来源左缘出，进目标右缘，方向朝左", () => {
		const route = routeEdge(rect(300, 0), rect(0, 100));

		expect(route.start).toEqual({ x: 300, y: 20 });
		expect(route.end).toEqual({ x: 100, y: 120 });
		expect(Math.abs(route.angle)).toBeCloseTo(Math.PI, 6);
	});

	it("同一列：从右缘绕出再回到目标右缘，不穿过中间的卡片", () => {
		const down = routeEdge(rect(0, 0), rect(0, 200));
		const up = routeEdge(rect(0, 200), rect(0, 0));

		expect(down.start).toEqual({ x: 100, y: 20 });
		expect(down.end).toEqual({ x: 100, y: 220 });
		// 终点处线朝左进入卡片右缘
		expect(Math.abs(down.angle)).toBeCloseTo(Math.PI, 6);
		expect(up.start).toEqual({ x: 100, y: 220 });
		expect(up.end).toEqual({ x: 100, y: 20 });
		// 弧线向右鼓出
		const controls = down.d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
		expect(controls[2]).toBeGreaterThan(100);
		expect(controls[4]).toBeGreaterThan(100);
	});

	it("同输入同输出，退化输入（同一矩形）不产生 NaN", () => {
		const a = routeEdge(rect(0, 0), rect(300, 100));
		const b = routeEdge(rect(0, 0), rect(300, 100));
		const degenerate = routeEdge(rect(10, 10), rect(10, 10));

		expect(a).toEqual(b);
		expect(degenerate.d).not.toMatch(/NaN|Infinity/);
		expect(Number.isFinite(degenerate.angle)).toBe(true);
	});
});

describe("线端标记", () => {
	it("箭头以终点为尖，沿切线方向向后展开", () => {
		const path = arrowHead({ x: 100, y: 50 }, 0, 10);

		expect(path).toBe("M 100 50 L 90 45 L 90 55 Z");
	});

	it("箭头随方向旋转", () => {
		const path = arrowHead({ x: 100, y: 50 }, Math.PI, 10);
		const numbers = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];

		expect(numbers[0]).toBeCloseTo(100, 6);
		expect(numbers[2]).toBeCloseTo(110, 6);
	});

	it("挡条垂直于切线方向，以终点为中心", () => {
		const path = blockerBar({ x: 100, y: 50 }, 0, 12);

		expect(path).toBe("M 100 44 L 100 56");
	});
});
