import { describe, expect, it } from "vitest";
import {
	buildTree,
	computeStates,
	coverNodes,
	removeNode,
	type TreeSelectOption,
	toggleNode,
	visibleRows,
} from "../tree-model";

const OPTIONS: TreeSelectOption[] = [
	{
		value: "2025",
		label: "2025",
		children: [
			{
				value: "trip",
				label: "旅行",
				children: [
					{ value: "duku", label: "独库公路" },
					{ value: "qinghai", label: "青海湖" },
				],
			},
			{ value: "daily", label: "日常", children: [{ value: "breakfast", label: "早餐" }] },
		],
	},
	{
		value: "2026",
		label: "2026",
		children: [
			{
				value: "season",
				label: "季节",
				children: [
					{ value: "spring", label: "春" },
					{ value: "summer", label: "夏" },
					{ value: "locked", label: "秋（锁定）", disabled: true },
				],
			},
		],
	},
	{ value: "avatar", label: "头像" },
];

const build = () => buildTree(OPTIONS, new Map(), false);
const states = (selected: string[]) => computeStates(build().roots, new Set(selected));
const cover = (selected: string[]) =>
	coverNodes(build().roots, states(selected)).map((node) => node.value);

describe("buildTree", () => {
	it("给节点标出层级、同级位置与种类", () => {
		const { byValue } = build();
		expect(byValue.get("duku")?.depth).toBe(2);
		expect(byValue.get("daily")?.position).toBe(2);
		expect(byValue.get("daily")?.setSize).toBe(2);
		expect(byValue.get("2025")?.kind).toBe("branch");
		expect(byValue.get("avatar")?.kind).toBe("leaf");
	});

	it("lazy 节点在能取回时等待子节点，取回后变成目录，取回为空则是叶子", () => {
		const lazy: TreeSelectOption[] = [{ value: "a", label: "甲", lazy: true }];
		expect(buildTree(lazy, new Map(), true).byValue.get("a")?.kind).toBe("lazy");
		expect(buildTree(lazy, new Map(), false).byValue.get("a")?.kind).toBe("leaf");
		const loaded = new Map([["a", [{ value: "b", label: "乙" }]]]);
		const tree = buildTree(lazy, loaded, true);
		expect(tree.byValue.get("a")?.kind).toBe("branch");
		expect(tree.byValue.get("b")?.depth).toBe(1);
		expect(buildTree(lazy, new Map([["a", []]]), true).byValue.get("a")?.kind).toBe("leaf");
	});
});

describe("勾选三态", () => {
	it("目录的状态由叶子推出：未选、部分选中、全部选中", () => {
		expect(states([]).get("trip")).toBe("none");
		expect(states(["duku"]).get("trip")).toBe("some");
		expect(states(["duku"]).get("2025")).toBe("some");
		expect(states(["duku", "qinghai"]).get("trip")).toBe("all");
		expect(states(["duku", "qinghai"]).get("2025")).toBe("some");
		expect(states(["duku", "qinghai", "breakfast"]).get("2025")).toBe("all");
	});

	it("没选的禁用叶子不拦着目录变成全部选中，选中的禁用叶子要算进去", () => {
		expect(states(["spring", "summer"]).get("season")).toBe("all");
		expect(states(["spring", "summer", "locked"]).get("season")).toBe("all");
		expect(states(["locked"]).get("season")).toBe("some");
		expect(states(["spring"]).get("season")).toBe("some");
	});
});

describe("覆盖最少节点", () => {
	it("选满的目录只留目录，部分选中的往下找", () => {
		expect(cover([])).toEqual([]);
		expect(cover(["duku", "qinghai"])).toEqual(["trip"]);
		expect(cover(["duku", "qinghai", "breakfast"])).toEqual(["2025"]);
		expect(cover(["duku", "breakfast"])).toEqual(["duku", "daily"]);
		expect(cover(["duku", "qinghai", "spring", "avatar"])).toEqual([
			"trip",
			"spring",
			"avatar",
		]);
	});

	it("全选后只剩最顶层的节点", () => {
		const all = ["duku", "qinghai", "breakfast", "spring", "summer", "avatar"];
		expect(cover(all)).toEqual(["2025", "2026", "avatar"]);
	});
});

describe("toggleNode / removeNode", () => {
	const node = (value: string) => {
		const found = build().byValue.get(value);
		if (!found) throw new Error(value);
		return found;
	};

	it("目录下的可选叶子全选就全部取消，否则全部选上", () => {
		expect(toggleNode(node("trip"), [])).toEqual(["duku", "qinghai"]);
		expect(toggleNode(node("trip"), ["duku"])).toEqual(["duku", "qinghai"]);
		expect(toggleNode(node("trip"), ["duku", "qinghai", "avatar"])).toEqual(["avatar"]);
	});

	it("禁用节点不动，目录里禁用的叶子不被选上也不被取消", () => {
		expect(toggleNode(node("locked"), [])).toEqual([]);
		expect(toggleNode(node("season"), [])).toEqual(["spring", "summer"]);
		expect(toggleNode(node("season"), ["spring", "summer", "locked"])).toEqual(["locked"]);
	});

	it("removeNode 取消目录下的全部叶子", () => {
		expect(removeNode(node("2025"), ["duku", "qinghai", "avatar"])).toEqual(["avatar"]);
	});
});

describe("visibleRows", () => {
	const values = (expanded: string[], query = "") =>
		visibleRows(build().roots, new Set(expanded), query).map((row) => row.node.value);

	it("按展开状态列出可见行", () => {
		expect(values([])).toEqual(["2025", "2026", "avatar"]);
		expect(values(["2025", "trip"])).toEqual([
			"2025",
			"trip",
			"duku",
			"qinghai",
			"daily",
			"2026",
			"avatar",
		]);
	});

	it("搜索只留匹配节点与祖先，祖先强制展开且不受记下的展开状态影响", () => {
		const rows = visibleRows(build().roots, new Set(), "春");
		expect(rows.map((row) => [row.node.value, row.open])).toEqual([
			["2026", true],
			["season", true],
			["spring", false],
		]);
		expect(values([], "  独库 ")).toEqual(["2025", "trip", "duku"]);
		expect(values([], "不存在")).toEqual([]);
	});

	it("搜索不分大小写、匹配任意一级", () => {
		const tree = buildTree(
			[{ value: "a", label: "Alpha", children: [{ value: "b", label: "Beta" }] }],
			new Map(),
			false,
		);
		expect(visibleRows(tree.roots, new Set(), "ALPHA").map((row) => row.node.value)).toEqual([
			"a",
		]);
		expect(visibleRows(tree.roots, new Set(), "bet").map((row) => row.node.value)).toEqual([
			"a",
			"b",
		]);
	});
});
