import { Tree, type TreeNodeData } from "@violet/ui";
import { useRef, useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

/** 模拟请求的耗时，足够看清梅花指示器。 */
const LOAD_MS = 700;

const RUST_CHAPTERS: TreeNodeData[] = [
	{ value: "rust-1", label: "第 1 章 · 所有权", meta: "2,300 字" },
	{ value: "rust-2", label: "第 2 章 · 异步", meta: "4,120 字" },
];

const DOC_NODES: TreeNodeData[] = [
	{
		value: "blog",
		label: "从零写一个博客",
		meta: "12 篇",
		children: [
			{ value: "blog-1", label: "第 1 章 · 脚手架", meta: "2,104 字" },
			{ value: "blog-2", label: "第 2 章 · 认证", meta: "3,410 字" },
			{
				value: "blog-3",
				label: "第 3 章 · 评论与批注",
				meta: "3,880 字",
				children: [
					{ value: "blog-3-1", label: "3.1 数据模型", meta: "1,200 字" },
					{ value: "blog-3-2", label: "3.2 批注怎么定位", meta: "2,680 字" },
				],
			},
			{ value: "blog-4", label: "第 4 章 · 部署", meta: "1,560 字" },
		],
	},
	{ value: "rust", label: "Rust 全栈笔记", meta: "7 篇", lazy: true },
	{
		value: "essay",
		label: "随笔",
		meta: "30 篇",
		children: [
			{ value: "essay-1", label: "独库公路，六天", meta: "5,600 字" },
			{ value: "essay-2", label: "胶片冲洗笔记", meta: "2,900 字" },
		],
	},
];

const FILE_NODES: TreeNodeData[] = [
	{
		value: "2026",
		label: "2026",
		children: [
			{
				value: "season",
				label: "季节",
				children: [
					{ value: "spring-petals", label: "spring-petals.webp", meta: "412 KB" },
					{ value: "winter-snow", label: "winter-snow.webp", meta: "388 KB" },
				],
			},
			{ value: "cover-season", label: "cover-season.webp", meta: "1.2 MB" },
		],
	},
	{
		value: "2025",
		label: "2025",
		children: [{ value: "duku-day3", label: "duku-day3.jpg", meta: "3.4 MB" }],
	},
	{ value: "avatar", label: "avatar.webp", meta: "96 KB" },
];

const RETRY_NODES: TreeNodeData[] = [
	{ value: "go", label: "Go 并发笔记", meta: "5 篇", lazy: true },
	{ value: "ts", label: "TypeScript 类型体操", meta: "9 篇", lazy: true },
];

const GO_CHAPTERS: TreeNodeData[] = [
	{ value: "go-1", label: "第 1 章 · goroutine", meta: "1,980 字" },
	{ value: "go-2", label: "第 2 章 · channel", meta: "2,450 字" },
];

function wait(ms: number) {
	return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** 当前项与展开集合由展品持有。 */
function ControlledTree({
	label,
	nodes,
	initialValue,
	initialExpanded,
	icons,
	loadChildren,
}: {
	label: string;
	nodes: TreeNodeData[];
	initialValue: string;
	initialExpanded: string[];
	icons?: boolean;
	loadChildren?: (node: TreeNodeData) => Promise<TreeNodeData[]>;
}) {
	const [value, setValue] = useState(initialValue);
	const [expanded, setExpanded] = useState(initialExpanded);
	return (
		<Tree
			aria-label={label}
			className="w-100"
			nodes={nodes}
			value={value}
			onValueChange={setValue}
			expanded={expanded}
			onExpandedChange={setExpanded}
			icons={icons}
			loadChildren={loadChildren}
		/>
	);
}

async function loadRust() {
	await wait(LOAD_MS);
	return RUST_CHAPTERS;
}

function DocsTree() {
	return (
		<ControlledTree
			label="系列目录"
			nodes={DOC_NODES}
			initialValue="blog-3-1"
			initialExpanded={["blog", "blog-3"]}
			loadChildren={loadRust}
		/>
	);
}

function FilesTree() {
	return (
		<ControlledTree
			label="素材文件"
			nodes={FILE_NODES}
			initialValue="cover-season"
			initialExpanded={["2026", "season"]}
			icons
		/>
	);
}

function RetryTree() {
	const attempts = useRef<Record<string, number>>({});
	const loadChildren = async (node: TreeNodeData) => {
		await wait(LOAD_MS);
		attempts.current[node.value] = (attempts.current[node.value] ?? 0) + 1;
		if (node.value === "go" && attempts.current.go === 1) throw new Error("请求失败");
		return node.value === "go" ? GO_CHAPTERS : RUST_CHAPTERS;
	};
	return (
		<ControlledTree
			label="系列目录（取回失败后重试）"
			nodes={RETRY_NODES}
			initialValue=""
			initialExpanded={[]}
			loadChildren={loadChildren}
		/>
	);
}

function TreeStage({ state }: ExhibitRenderProps) {
	switch (state) {
		case "files":
			return <FilesTree />;
		case "retry":
			return <RetryTree />;
		default:
			return <DocsTree />;
	}
}

export const treeExhibit: Exhibit = {
	id: "tree",
	name: "树",
	units: ["tree"],
	zone: "content",
	category: "display",
	footprint: { width: 420, height: 460 },
	states: [
		{ id: "docs", label: "文档目录" },
		{ id: "files", label: "文件树" },
		{ id: "retry", label: "取回失败重试" },
	],
	Render: TreeStage,
};
