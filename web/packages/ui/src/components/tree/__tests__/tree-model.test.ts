import { describe, expect, it } from "vitest";
import {
	ancestorsOf,
	buildTree,
	enabledParentOf,
	matchPrefix,
	type TreeNodeData,
	type VisibleRow,
	visibleRows,
} from "../tree-model";

const NODES: TreeNodeData[] = [
	{
		value: "blog",
		label: "从零写一个博客",
		children: [
			{ value: "ch1", label: "第 1 章" },
			{
				value: "ch3",
				label: "第 3 章",
				children: [
					{ value: "ch3-1", label: "3.1 数据模型" },
					{ value: "ch3-2", label: "3.2 批注", disabled: true },
				],
			},
		],
	},
	{ value: "rust", label: "Rust 全栈笔记", lazy: true },
	{ value: "essay", label: "随笔" },
];

const NONE = new Map<string, readonly TreeNodeData[]>();
const values = (rows: VisibleRow[]) => rows.map((row) => row.node.value);

describe("buildTree", () => {
	it("按层级给出深度、父级、同级位置与同级总数", () => {
		const { roots, byValue } = buildTree(NODES, NONE, true);
		expect(roots.map((node) => [node.value, node.position, node.setSize])).toEqual([
			["blog", 1, 3],
			["rust", 2, 3],
			["essay", 3, 3],
		]);
		const deep = byValue.get("ch3-2");
		expect(deep?.depth).toBe(2);
		expect(deep?.parent?.value).toBe("ch3");
		expect([deep?.position, deep?.setSize]).toEqual([2, 2]);
		expect(roots[0]?.children.map((node) => node.position)).toEqual([1, 2]);
	});

	it("按有无子节点和 lazy 区分节点种类", () => {
		const { byValue } = buildTree(NODES, NONE, true);
		expect(byValue.get("blog")?.kind).toBe("branch");
		expect(byValue.get("ch1")?.kind).toBe("leaf");
		expect(byValue.get("rust")?.kind).toBe("lazy");
	});

	it("不能取回时 lazy 节点按叶子处理", () => {
		expect(buildTree(NODES, NONE, false).byValue.get("rust")?.kind).toBe("leaf");
	});

	it("取回的子节点接到父节点下；取回空数组的节点变叶子", () => {
		const loaded = new Map<string, readonly TreeNodeData[]>([
			["rust", [{ value: "own", label: "所有权" }]],
		]);
		const withKids = buildTree(NODES, loaded, true);
		expect(withKids.byValue.get("rust")?.kind).toBe("branch");
		expect(withKids.byValue.get("own")?.parent?.value).toBe("rust");
		expect(withKids.byValue.get("own")?.depth).toBe(1);

		const empty = buildTree(NODES, new Map([["rust", []]]), true);
		expect(empty.byValue.get("rust")?.kind).toBe("leaf");
	});

	it("节点自带 children 时不看取回的结果", () => {
		const nodes: TreeNodeData[] = [
			{ value: "a", label: "A", lazy: true, children: [{ value: "a1", label: "A1" }] },
		];
		const loaded = new Map([["a", [{ value: "x", label: "X" }]]]);
		const { byValue } = buildTree(nodes, loaded, true);
		expect(byValue.has("a1")).toBe(true);
		expect(byValue.has("x")).toBe(false);
	});

	it("value 重复时查找取先出现的节点", () => {
		const { byValue } = buildTree(
			[
				{ value: "d", label: "先" },
				{ value: "d", label: "后" },
			],
			NONE,
			true,
		);
		expect(byValue.get("d")?.label).toBe("先");
	});
});

describe("ancestorsOf / enabledParentOf", () => {
	it("祖先由近及远，根没有祖先", () => {
		const { byValue } = buildTree(NODES, NONE, true);
		const node = byValue.get("ch3-1");
		expect(node && ancestorsOf(node).map((item) => item.value)).toEqual(["ch3", "blog"]);
		const root = byValue.get("blog");
		expect(root && ancestorsOf(root)).toEqual([]);
	});

	it("上级跳过被禁用的祖先，都禁用或已是根时为 null", () => {
		const nodes: TreeNodeData[] = [
			{
				value: "a",
				label: "A",
				children: [
					{
						value: "b",
						label: "B",
						disabled: true,
						children: [{ value: "c", label: "C" }],
					},
				],
			},
			{ value: "z", label: "Z", disabled: true, children: [{ value: "y", label: "Y" }] },
		];
		const { byValue } = buildTree(nodes, NONE, true);
		const c = byValue.get("c");
		const y = byValue.get("y");
		const a = byValue.get("a");
		expect(c && enabledParentOf(c)?.value).toBe("a");
		expect(y && enabledParentOf(y)).toBeNull();
		expect(a && enabledParentOf(a)).toBeNull();
	});
});

describe("visibleRows", () => {
	it("只展开 expanded 里的目录，顺序即屏幕顺序", () => {
		const { roots } = buildTree(NODES, NONE, true);
		expect(values(visibleRows(roots, new Set()))).toEqual(["blog", "rust", "essay"]);
		expect(values(visibleRows(roots, new Set(["blog"])))).toEqual([
			"blog",
			"ch1",
			"ch3",
			"rust",
			"essay",
		]);
		expect(values(visibleRows(roots, new Set(["blog", "ch3"])))).toEqual([
			"blog",
			"ch1",
			"ch3",
			"ch3-1",
			"ch3-2",
			"rust",
			"essay",
		]);
	});

	it("子级在 expanded 里但祖先没展开时不出现", () => {
		const { roots } = buildTree(NODES, NONE, true);
		expect(values(visibleRows(roots, new Set(["ch3"])))).toEqual(["blog", "rust", "essay"]);
	});

	it("open 反映展开状态；还没取回的 lazy 节点没有子行", () => {
		const { roots } = buildTree(NODES, NONE, true);
		const rows = visibleRows(roots, new Set(["blog", "rust"]));
		expect(rows.map((row) => [row.node.value, row.open])).toEqual([
			["blog", true],
			["ch1", false],
			["ch3", false],
			["rust", true],
			["essay", false],
		]);
	});
});

describe("matchPrefix", () => {
	const { roots } = buildTree(
		[
			{ value: "a1", label: "Alpha" },
			{ value: "b1", label: "Beta" },
			{ value: "a2", label: "Atlas", disabled: true },
			{ value: "a3", label: "April" },
			{ value: "c1", label: "春" },
		],
		NONE,
		true,
	);
	const rows = visibleRows(roots, new Set());

	it("从下一行找起、不分大小写、到末尾后回到开头", () => {
		expect(matchPrefix(rows, "a", 0, false)).toBe(3);
		expect(matchPrefix(rows, "a", 3, false)).toBe(0);
		expect(matchPrefix(rows, "B", 0, false)).toBe(1);
	});

	it("inclusive 时当前行也参与", () => {
		expect(matchPrefix(rows, "al", 0, true)).toBe(0);
		expect(matchPrefix(rows, "ap", 0, true)).toBe(3);
	});

	it("跳过禁用行，没有匹配返回 -1，空列表返回 -1", () => {
		expect(matchPrefix(rows, "at", 0, true)).toBe(-1);
		expect(matchPrefix(rows, "z", 0, false)).toBe(-1);
		expect(matchPrefix([], "a", 0, true)).toBe(-1);
	});

	it("非拉丁文字按字符前缀匹配", () => {
		expect(matchPrefix(rows, "春", 0, false)).toBe(4);
	});
});
