import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef, useState } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Tree, type TreeNodeData, type TreeProps } from "../tree";

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

// 包的 lib 目标没有 Promise.withResolvers
function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

const DOCS: TreeNodeData[] = [
	{
		value: "blog",
		label: "从零写一个博客",
		meta: "12 篇",
		children: [
			{ value: "ch1", label: "第 1 章 · 脚手架" },
			{ value: "ch2", label: "第 2 章 · 认证", disabled: true },
			{
				value: "ch3",
				label: "第 3 章 · 评论",
				children: [{ value: "ch3-1", label: "3.1 数据模型" }],
			},
			{ value: "ch4", label: "第 4 章 · 部署" },
		],
	},
	{ value: "rust", label: "Rust 全栈笔记", lazy: true },
	{ value: "essay", label: "随笔", children: [{ value: "duku", label: "独库公路" }] },
	{ value: "misc", label: "杂记" },
];

function setup(props: Partial<TreeProps> = {}) {
	const utils = render(<Tree aria-label="系列目录" nodes={DOCS} {...props} />);
	return { ...utils, tree: screen.getByRole("tree", { name: "系列目录" }) };
}

const key = (tree: HTMLElement, name: string, init: KeyboardEventInit = {}) =>
	fireEvent.keyDown(tree, { key: name, ...init });

const row = (name: string) => screen.getByRole("treeitem", { name });
const labels = () => screen.getAllByRole("treeitem").map((item) => item.textContent);
const chevronOf = (name: string) => {
	const chevron = row(name).querySelector("[data-tree-chevron]");
	if (!chevron) throw new Error(`${name} 没有展开箭头`);
	return chevron;
};

/** aria-activedescendant 指向的行的名称。 */
function activeName(tree: HTMLElement) {
	const id = tree.getAttribute("aria-activedescendant");
	const target = id ? document.getElementById(id) : null;
	expect(target?.getAttribute("role")).toBe("treeitem");
	return target?.getAttribute("aria-labelledby")
		? document.getElementById(target.getAttribute("aria-labelledby") ?? "")?.textContent
		: null;
}

describe("角色与读屏契约", () => {
	it("容器 role=tree 带名称，行 role=treeitem 带层级、位置与总数", () => {
		setup({ defaultExpanded: ["blog", "ch3"] });
		expect(screen.getAllByRole("treeitem")).toHaveLength(9);
		const rowAt = (name: string) =>
			["aria-level", "aria-posinset", "aria-setsize"].map((attr) =>
				row(name).getAttribute(attr),
			);
		expect(rowAt("从零写一个博客")).toEqual(["1", "1", "4"]);
		expect(rowAt("杂记")).toEqual(["1", "4", "4"]);
		expect(rowAt("第 2 章 · 认证")).toEqual(["2", "2", "4"]);
		expect(rowAt("3.1 数据模型")).toEqual(["3", "1", "1"]);
	});

	it("aria-expanded 只给目录：收起 false、展开 true，叶子没有", () => {
		setup({ defaultExpanded: ["blog"] });
		expect(row("从零写一个博客").getAttribute("aria-expanded")).toBe("true");
		expect(row("第 3 章 · 评论").getAttribute("aria-expanded")).toBe("false");
		expect(row("随笔").getAttribute("aria-expanded")).toBe("false");
		expect(row("杂记").hasAttribute("aria-expanded")).toBe(false);
		expect(row("第 1 章 · 脚手架").hasAttribute("aria-expanded")).toBe(false);
	});

	it("aria-selected 写在每一行上，只有当前项为 true", () => {
		setup({ defaultValue: "essay" });
		const states = screen
			.getAllByRole("treeitem")
			.map((item) => [item.textContent, item.getAttribute("aria-selected")]);
		expect(states).toEqual([
			["从零写一个博客12 篇", "false"],
			["Rust 全栈笔记", "false"],
			["随笔", "true"],
			["杂记", "false"],
		]);
	});

	it("行的名称取文字，计数作为描述，不混进名称", () => {
		setup();
		const blog = row("从零写一个博客");
		const described = blog.getAttribute("aria-describedby");
		expect(described && document.getElementById(described)?.textContent).toBe("12 篇");
		expect(row("杂记").hasAttribute("aria-describedby")).toBe(false);
	});

	it("禁用的行写 aria-disabled", () => {
		setup({ defaultExpanded: ["blog"] });
		expect(row("第 2 章 · 认证").getAttribute("aria-disabled")).toBe("true");
		expect(row("第 1 章 · 脚手架").hasAttribute("aria-disabled")).toBe(false);
	});

	it("aria-labelledby 命名整棵树，原生属性、className、ref 落在容器上", () => {
		const ref = createRef<HTMLDivElement>();
		render(
			<>
				<h2 id="docs-title">文档</h2>
				<Tree
					ref={ref}
					aria-labelledby="docs-title"
					data-testid="docs"
					className="custom"
					nodes={DOCS}
				/>
			</>,
		);
		const tree = screen.getByRole("tree", { name: "文档" });
		expect(ref.current).toBe(tree);
		expect(tree.getAttribute("data-testid")).toBe("docs");
		expect(tree.classList.contains("custom")).toBe(true);
	});

	it("服务端渲染的 aria-activedescendant 指向存在的行，value 里的特殊字符不会让 id 重复", () => {
		const html = renderToString(
			<Tree
				aria-label="特殊"
				nodes={[
					{ value: "a b", label: "空格" },
					{ value: "a_20_b", label: "下划线" },
				]}
			/>,
		);
		const host = document.createElement("div");
		host.innerHTML = html;
		const ids = [...host.querySelectorAll("[role=treeitem]")].map((item) => item.id);
		expect(new Set(ids).size).toBe(2);
		const active = host.querySelector("[role=tree]")?.getAttribute("aria-activedescendant");
		expect(ids).toContain(active);
	});
});

describe("焦点", () => {
	it("整棵树只占一个 Tab 位置：容器 tabindex=0，行与箭头都不可聚焦", () => {
		const { container } = setup({ defaultExpanded: ["blog"] });
		const stops = container.querySelectorAll(
			"[tabindex]:not([tabindex='-1']), button, a, input, select, textarea",
		);
		expect([...stops]).toEqual([screen.getByRole("tree")]);
	});

	it("键盘所在行默认是当前项，没有当前项时是第一个可用行", () => {
		const { tree, unmount } = setup({ defaultValue: "essay" });
		expect(activeName(tree)).toBe("随笔");
		unmount();
		const second = setup();
		expect(activeName(second.tree)).toBe("从零写一个博客");
	});

	it("行有稳定的 id：重新渲染前后不变", () => {
		const { tree, rerender } = setup();
		const before = tree.getAttribute("aria-activedescendant");
		rerender(<Tree aria-label="系列目录" nodes={DOCS} defaultValue="" />);
		expect(tree.getAttribute("aria-activedescendant")).toBe(before);
	});

	it("键盘所在行被外部收起时回到当前项；当前项也看不见则回到第一行", () => {
		function Harness({ expanded, value }: { expanded: string[]; value: string }) {
			return <Tree aria-label="系列目录" nodes={DOCS} expanded={expanded} value={value} />;
		}
		const { rerender } = render(<Harness expanded={["blog"]} value="essay" />);
		const tree = screen.getByRole("tree");
		key(tree, "Home");
		key(tree, "ArrowDown");
		expect(activeName(tree)).toBe("第 1 章 · 脚手架");
		rerender(<Harness expanded={[]} value="essay" />);
		expect(activeName(tree)).toBe("随笔");
		cleanup();

		const hidden = render(<Harness expanded={["blog"]} value="ch4" />);
		expect(activeName(hidden.getByRole("tree"))).toBe("第 4 章 · 部署");
		hidden.rerender(<Harness expanded={[]} value="ch4" />);
		expect(activeName(hidden.getByRole("tree"))).toBe("从零写一个博客");
	});
});

describe("按键", () => {
	it("↑ ↓ 在可见行之间移动，不循环", () => {
		const { tree } = setup();
		key(tree, "ArrowUp");
		expect(activeName(tree)).toBe("从零写一个博客");
		key(tree, "ArrowDown");
		expect(activeName(tree)).toBe("Rust 全栈笔记");
		key(tree, "ArrowDown");
		key(tree, "ArrowDown");
		expect(activeName(tree)).toBe("杂记");
		key(tree, "ArrowDown");
		expect(activeName(tree)).toBe("杂记");
	});

	it("Home / End 到首尾", () => {
		const { tree } = setup({ defaultValue: "essay" });
		key(tree, "End");
		expect(activeName(tree)).toBe("杂记");
		key(tree, "Home");
		expect(activeName(tree)).toBe("从零写一个博客");
	});

	it("禁用的行被 ↑ ↓ 与 Home / End 跳过", () => {
		const nodes: TreeNodeData[] = [
			{ value: "a", label: "甲", disabled: true },
			{ value: "b", label: "乙" },
			{ value: "c", label: "丙", disabled: true },
			{ value: "d", label: "丁" },
			{ value: "e", label: "戊", disabled: true },
		];
		const { tree } = setup({ nodes });
		expect(activeName(tree)).toBe("乙");
		key(tree, "ArrowDown");
		expect(activeName(tree)).toBe("丁");
		key(tree, "ArrowDown");
		expect(activeName(tree)).toBe("丁");
		key(tree, "ArrowUp");
		key(tree, "ArrowUp");
		expect(activeName(tree)).toBe("乙");
		key(tree, "End");
		expect(activeName(tree)).toBe("丁");
		key(tree, "Home");
		expect(activeName(tree)).toBe("乙");
	});

	it("→ 展开收起的目录；已展开再按进入第一个可用的子项", () => {
		const { tree } = setup();
		key(tree, "ArrowRight");
		expect(row("从零写一个博客").getAttribute("aria-expanded")).toBe("true");
		expect(activeName(tree)).toBe("从零写一个博客");
		key(tree, "ArrowRight");
		expect(activeName(tree)).toBe("第 1 章 · 脚手架");
	});

	it("→ 进入子项时跳过被禁用的第一个子项；全部禁用则不动", () => {
		const nodes: TreeNodeData[] = [
			{
				value: "p",
				label: "父",
				children: [
					{ value: "x", label: "先", disabled: true },
					{ value: "y", label: "后" },
				],
			},
			{
				value: "q",
				label: "全禁",
				children: [{ value: "z", label: "禁", disabled: true }],
			},
		];
		const { tree } = setup({ nodes, defaultExpanded: ["p", "q"] });
		key(tree, "ArrowRight");
		expect(activeName(tree)).toBe("后");
		key(tree, "ArrowUp");
		key(tree, "ArrowUp");
		key(tree, "ArrowDown");
		key(tree, "ArrowDown");
		expect(activeName(tree)).toBe("全禁");
		key(tree, "ArrowRight");
		expect(activeName(tree)).toBe("全禁");
	});

	it("→ 在叶子上不动", () => {
		const { tree } = setup({ defaultValue: "misc" });
		key(tree, "ArrowRight");
		expect(activeName(tree)).toBe("杂记");
	});

	it("← 收起展开的目录；已收起回到上级；叶子回到上级；根上不动", () => {
		const { tree } = setup({ defaultExpanded: ["blog", "ch3"], defaultValue: "ch3-1" });
		key(tree, "ArrowLeft");
		expect(activeName(tree)).toBe("第 3 章 · 评论");
		key(tree, "ArrowLeft");
		expect(row("第 3 章 · 评论").getAttribute("aria-expanded")).toBe("false");
		expect(activeName(tree)).toBe("第 3 章 · 评论");
		key(tree, "ArrowLeft");
		expect(activeName(tree)).toBe("从零写一个博客");
		key(tree, "ArrowLeft");
		expect(row("从零写一个博客").getAttribute("aria-expanded")).toBe("false");
		key(tree, "ArrowLeft");
		expect(activeName(tree)).toBe("从零写一个博客");
	});

	it("Enter 与 Space 选中键盘所在的行，目录也能选，已选的不再触发", () => {
		const onValueChange = vi.fn();
		const { tree } = setup({ onValueChange });
		key(tree, "Enter");
		expect(onValueChange).toHaveBeenLastCalledWith("blog");
		expect(row("从零写一个博客").getAttribute("aria-selected")).toBe("true");
		key(tree, "ArrowDown");
		key(tree, " ");
		expect(onValueChange).toHaveBeenLastCalledWith("rust");
		expect(onValueChange).toHaveBeenCalledTimes(2);
		key(tree, "Enter");
		expect(onValueChange).toHaveBeenCalledTimes(2);
		expect(row("Rust 全栈笔记").getAttribute("aria-selected")).toBe("true");
		expect(row("从零写一个博客").getAttribute("aria-selected")).toBe("false");
	});

	it("移动与展开不改变当前项", () => {
		const onValueChange = vi.fn();
		const { tree } = setup({ onValueChange, defaultValue: "misc" });
		key(tree, "Home");
		key(tree, "ArrowRight");
		key(tree, "ArrowRight");
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it("处理过的按键取消默认行为，其余按键（Tab 等）不拦", () => {
		const { tree } = setup();
		expect(key(tree, "ArrowDown")).toBe(false);
		expect(key(tree, " ")).toBe(false);
		expect(key(tree, "Tab")).toBe(true);
		expect(key(tree, "Escape")).toBe(true);
	});

	it("带 Ctrl、Meta、Alt 的组合键与输入法组合中的按键都不处理", () => {
		const { tree } = setup();
		key(tree, "ArrowDown", { ctrlKey: true });
		key(tree, "ArrowDown", { metaKey: true });
		key(tree, "ArrowDown", { altKey: true });
		key(tree, "ArrowDown", { isComposing: true });
		expect(activeName(tree)).toBe("从零写一个博客");
	});

	it("调用方的 onKeyDown 先执行，preventDefault 后组件不再处理", () => {
		const { tree } = setup({ onKeyDown: (event) => event.preventDefault() });
		key(tree, "ArrowDown");
		expect(activeName(tree)).toBe("从零写一个博客");
	});
});

describe("输入字母跳行（typeahead）", () => {
	it("输入字母跳到以它开头的可见行，不分大小写，到末尾后回到开头", () => {
		const { tree } = setup();
		key(tree, "r");
		expect(activeName(tree)).toBe("Rust 全栈笔记");
		vi.useFakeTimers();
		act(() => {
			vi.advanceTimersByTime(600);
		});
		key(tree, "R");
		expect(activeName(tree)).toBe("Rust 全栈笔记");
		act(() => {
			vi.advanceTimersByTime(600);
		});
		key(tree, "随");
		expect(activeName(tree)).toBe("随笔");
	});

	it("只找可见的行：收起的子项不参与，展开后参与", () => {
		const { tree } = setup();
		key(tree, "独");
		expect(activeName(tree)).toBe("从零写一个博客");
		cleanup();
		const expanded = setup({ defaultExpanded: ["essay"] });
		key(expanded.tree, "独");
		expect(activeName(expanded.tree)).toBe("独库公路");
	});

	it("连续输入累积成前缀，停顿超过 500ms 后重新开始", () => {
		vi.useFakeTimers();
		const nodes: TreeNodeData[] = [
			{ value: "1", label: "Alpha" },
			{ value: "2", label: "Atlas" },
			{ value: "3", label: "Beta" },
			{ value: "4", label: "Apple", disabled: true },
		];
		const { tree } = setup({ nodes });
		key(tree, "a");
		key(tree, "t");
		expect(activeName(tree)).toBe("Atlas");
		act(() => {
			vi.advanceTimersByTime(499);
		});
		key(tree, "l");
		expect(activeName(tree)).toBe("Atlas");
		act(() => {
			vi.advanceTimersByTime(501);
		});
		// 缓冲已清空：这是新的一次 "a"，从当前行的下一行找起并回到开头
		key(tree, "a");
		expect(activeName(tree)).toBe("Alpha");
	});

	it("反复按同一个字母在同首字母的行间循环，跳过禁用行", () => {
		const nodes: TreeNodeData[] = [
			{ value: "1", label: "Alpha" },
			{ value: "2", label: "Apple", disabled: true },
			{ value: "3", label: "Atlas" },
			{ value: "4", label: "Beta" },
		];
		const { tree } = setup({ nodes });
		key(tree, "a");
		expect(activeName(tree)).toBe("Atlas");
		key(tree, "a");
		expect(activeName(tree)).toBe("Alpha");
		key(tree, "a");
		expect(activeName(tree)).toBe("Atlas");
	});

	it("没有匹配时不动", () => {
		const { tree } = setup();
		key(tree, "z");
		expect(activeName(tree)).toBe("从零写一个博客");
	});

	it("输入中的空格属于前缀，不会选中当前行", () => {
		const onValueChange = vi.fn();
		const { tree } = setup({ onValueChange });
		for (const char of "rust ") key(tree, char);
		expect(onValueChange).not.toHaveBeenCalled();
		expect(activeName(tree)).toBe("Rust 全栈笔记");
	});

	it("输入字母只移动不选中", () => {
		const onValueChange = vi.fn();
		const { tree } = setup({ onValueChange });
		key(tree, "杂");
		expect(onValueChange).not.toHaveBeenCalled();
	});
});

describe("点箭头与点行", () => {
	it("点箭头只展开收起，不改变当前项", () => {
		const onValueChange = vi.fn();
		setup({ onValueChange });
		fireEvent.click(chevronOf("从零写一个博客"));
		expect(row("从零写一个博客").getAttribute("aria-expanded")).toBe("true");
		expect(labels()).toContain("第 1 章 · 脚手架");
		fireEvent.click(chevronOf("从零写一个博客"));
		expect(row("从零写一个博客").getAttribute("aria-expanded")).toBe("false");
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it("点行选中，不展开收起", () => {
		const onValueChange = vi.fn();
		setup({ onValueChange });
		fireEvent.click(row("从零写一个博客"));
		expect(onValueChange).toHaveBeenCalledWith("blog");
		expect(row("从零写一个博客").getAttribute("aria-selected")).toBe("true");
		expect(row("从零写一个博客").getAttribute("aria-expanded")).toBe("false");
	});

	it("点击把键盘所在行移到被点的行", () => {
		const { tree } = setup();
		fireEvent.click(row("杂记"));
		expect(activeName(tree)).toBe("杂记");
		fireEvent.click(chevronOf("随笔"));
		expect(activeName(tree)).toBe("随笔");
	});

	it("禁用的行点击无效：不选中，也不移动键盘所在行", () => {
		const onValueChange = vi.fn();
		const { tree } = setup({ onValueChange, defaultExpanded: ["blog"] });
		fireEvent.click(row("第 2 章 · 认证"));
		expect(onValueChange).not.toHaveBeenCalled();
		expect(activeName(tree)).toBe("从零写一个博客");
	});

	it("叶子没有箭头，点叶子就是选中", () => {
		const onValueChange = vi.fn();
		setup({ onValueChange });
		expect(row("杂记").querySelector("[data-tree-chevron]")).toBeNull();
		fireEvent.click(row("杂记"));
		expect(onValueChange).toHaveBeenCalledWith("misc");
	});
});

describe("受控与非受控", () => {
	it("非受控：defaultValue 起始，选中后自己更新；defaultExpanded 起始，展开收起自己更新", () => {
		setup({ defaultValue: "misc", defaultExpanded: ["essay"] });
		expect(row("杂记").getAttribute("aria-selected")).toBe("true");
		expect(labels()).toContain("独库公路");
		fireEvent.click(row("随笔"));
		expect(row("随笔").getAttribute("aria-selected")).toBe("true");
		expect(row("杂记").getAttribute("aria-selected")).toBe("false");
		fireEvent.click(chevronOf("随笔"));
		expect(labels()).not.toContain("独库公路");
	});

	it("受控的选中：不回写就不变，回写后才变", () => {
		const onValueChange = vi.fn();
		const { rerender } = render(
			<Tree aria-label="t" nodes={DOCS} value="misc" onValueChange={onValueChange} />,
		);
		fireEvent.click(row("随笔"));
		expect(onValueChange).toHaveBeenCalledWith("essay");
		expect(row("杂记").getAttribute("aria-selected")).toBe("true");
		rerender(<Tree aria-label="t" nodes={DOCS} value="essay" onValueChange={onValueChange} />);
		expect(row("随笔").getAttribute("aria-selected")).toBe("true");
		expect(row("杂记").getAttribute("aria-selected")).toBe("false");
	});

	it("受控的选中：value 换成空串或不存在的值，没有任何行被选中", () => {
		const { rerender } = render(<Tree aria-label="t" nodes={DOCS} value="misc" />);
		rerender(<Tree aria-label="t" nodes={DOCS} value="" />);
		expect(
			screen
				.getAllByRole("treeitem")
				.every((item) => item.getAttribute("aria-selected") === "false"),
		).toBe(true);
		rerender(<Tree aria-label="t" nodes={DOCS} value="nope" />);
		expect(
			screen
				.getAllByRole("treeitem")
				.every((item) => item.getAttribute("aria-selected") === "false"),
		).toBe(true);
	});

	it("受控的展开：onExpandedChange 收到新数组，不回写就不展开", () => {
		const onExpandedChange = vi.fn();
		const { rerender } = render(
			<Tree aria-label="t" nodes={DOCS} expanded={[]} onExpandedChange={onExpandedChange} />,
		);
		const tree = screen.getByRole("tree");
		key(tree, "ArrowRight");
		expect(onExpandedChange).toHaveBeenLastCalledWith(["blog"]);
		expect(row("从零写一个博客").getAttribute("aria-expanded")).toBe("false");
		rerender(
			<Tree
				aria-label="t"
				nodes={DOCS}
				expanded={["blog"]}
				onExpandedChange={onExpandedChange}
			/>,
		);
		expect(row("从零写一个博客").getAttribute("aria-expanded")).toBe("true");
		fireEvent.click(chevronOf("从零写一个博客"));
		expect(onExpandedChange).toHaveBeenLastCalledWith([]);
	});

	it("非受控的展开也会通知 onExpandedChange", () => {
		const onExpandedChange = vi.fn();
		setup({ onExpandedChange, defaultExpanded: ["essay"] });
		fireEvent.click(chevronOf("从零写一个博客"));
		expect(onExpandedChange).toHaveBeenLastCalledWith(["essay", "blog"]);
	});

	it("父组件持有选中与展开时，键盘与点击都走它", () => {
		function Harness() {
			const [value, setValue] = useState("");
			const [expanded, setExpanded] = useState<string[]>([]);
			return (
				<>
					<output>{value || "无"}</output>
					<Tree
						aria-label="t"
						nodes={DOCS}
						value={value}
						onValueChange={setValue}
						expanded={expanded}
						onExpandedChange={setExpanded}
					/>
				</>
			);
		}
		render(<Harness />);
		const tree = screen.getByRole("tree");
		key(tree, "ArrowRight");
		key(tree, "ArrowRight");
		key(tree, "Enter");
		expect(screen.getByRole("status").textContent).toBe("ch1");
		expect(row("第 1 章 · 脚手架").getAttribute("aria-selected")).toBe("true");
	});
});

describe("图标与计数", () => {
	it("默认没有图标；icons 给没有自带图标的节点补默认图标，目录展开时换打开的文件夹", () => {
		const { container, rerender } = render(
			<Tree aria-label="t" nodes={DOCS} defaultExpanded={["essay"]} />,
		);
		expect(container.querySelector("svg.lucide-folder, svg.lucide-file")).toBeNull();
		rerender(<Tree aria-label="t" nodes={DOCS} defaultExpanded={["essay"]} icons />);
		expect(row("随笔").querySelector("svg.lucide-folder-open")).not.toBeNull();
		expect(row("从零写一个博客").querySelector("svg.lucide-folder")).not.toBeNull();
		expect(row("独库公路").querySelector("svg.lucide-file")).not.toBeNull();
		fireEvent.click(chevronOf("随笔"));
		expect(row("随笔").querySelector("svg.lucide-folder")).not.toBeNull();
	});

	it("节点自带的 icon 优先于默认图标，icon 为 null 表示这一行不要图标", () => {
		render(
			<Tree
				aria-label="t"
				icons
				nodes={[
					{ value: "a", label: "甲", icon: <svg data-testid="mine" /> },
					{ value: "b", label: "乙", icon: null },
				]}
			/>,
		);
		expect(row("甲").querySelector("[data-testid=mine]")).not.toBeNull();
		expect(row("甲").querySelector("svg.lucide-file")).toBeNull();
		expect(row("乙").querySelector("svg.lucide-file")).toBeNull();
	});

	it("meta 显示在行内", () => {
		setup();
		expect(row("从零写一个博客").textContent).toContain("12 篇");
	});
});

describe("懒加载", () => {
	const RUST_CHILDREN: TreeNodeData[] = [
		{ value: "own", label: "第 1 章 · 所有权" },
		{ value: "async", label: "第 2 章 · 异步" },
	];

	it("首次展开才去取：行 aria-busy、箭头换成梅花指示器；取回后子项直接出现", async () => {
		const pending = deferred<TreeNodeData[]>();
		const loadChildren = vi.fn(() => pending.promise);
		const { container } = setup({ loadChildren });
		expect(loadChildren).not.toHaveBeenCalled();
		expect(row("Rust 全栈笔记").getAttribute("aria-expanded")).toBe("false");

		fireEvent.click(chevronOf("Rust 全栈笔记"));
		expect(loadChildren).toHaveBeenCalledTimes(1);
		expect(loadChildren).toHaveBeenCalledWith(expect.objectContaining({ value: "rust" }));
		expect(row("Rust 全栈笔记").getAttribute("aria-busy")).toBe("true");
		expect(row("Rust 全栈笔记").getAttribute("aria-expanded")).toBe("true");
		expect(container.querySelector(".v-flower--plum")).not.toBeNull();
		expect(row("Rust 全栈笔记").querySelector("svg.lucide-chevron-right")).toBeNull();

		pending.resolve(RUST_CHILDREN);
		await settle();
		expect(row("Rust 全栈笔记").hasAttribute("aria-busy")).toBe(false);
		expect(container.querySelector(".v-flower--plum")).toBeNull();
		expect(row("第 1 章 · 所有权").getAttribute("aria-level")).toBe("2");
		expect(row("第 2 章 · 异步").getAttribute("aria-posinset")).toBe("2");
		expect(row("Rust 全栈笔记").getAttribute("aria-expanded")).toBe("true");
	});

	it("键盘 → 同样触发取回，取回的已缓存：收起再展开不再取", async () => {
		const loadChildren = vi.fn(async () => RUST_CHILDREN);
		const { tree } = setup({ loadChildren });
		key(tree, "ArrowDown");
		key(tree, "ArrowRight");
		await settle();
		expect(labels()).toContain("第 1 章 · 所有权");
		key(tree, "ArrowLeft");
		expect(labels()).not.toContain("第 1 章 · 所有权");
		key(tree, "ArrowRight");
		expect(labels()).toContain("第 1 章 · 所有权");
		expect(loadChildren).toHaveBeenCalledTimes(1);
		key(tree, "ArrowRight");
		expect(activeName(tree)).toBe("第 1 章 · 所有权");
	});

	it("在途时重复展开不会重复请求", async () => {
		const pending = deferred<TreeNodeData[]>();
		const loadChildren = vi.fn(() => pending.promise);
		const { tree } = setup({ loadChildren });
		key(tree, "ArrowDown");
		key(tree, "ArrowRight");
		key(tree, "ArrowRight");
		fireEvent.click(chevronOf("Rust 全栈笔记"));
		pending.resolve(RUST_CHILDREN);
		await settle();
		expect(loadChildren).toHaveBeenCalledTimes(1);
	});

	it("失败时整行标出失败并提示重试，行收起；点行、点箭头、→、Enter 都重试", async () => {
		const onValueChange = vi.fn();
		const loadChildren = vi.fn<() => Promise<TreeNodeData[]>>(async () => {
			throw new Error("网络断了");
		});
		const { tree, container } = setup({ loadChildren, onValueChange });
		fireEvent.click(chevronOf("Rust 全栈笔记"));
		await settle();
		const failed = row("Rust 全栈笔记");
		expect(failed.hasAttribute("data-failed")).toBe(true);
		expect(failed.hasAttribute("aria-busy")).toBe(false);
		expect(failed.getAttribute("aria-expanded")).toBe("false");
		const hint = failed.getAttribute("aria-describedby");
		expect(hint && document.getElementById(hint)?.textContent).toBe("加载失败，点击重试");
		expect(container.querySelector(".v-flower")).toBeNull();

		fireEvent.click(failed);
		expect(loadChildren).toHaveBeenCalledTimes(2);
		expect(onValueChange).not.toHaveBeenCalled();
		await settle();

		fireEvent.click(chevronOf("Rust 全栈笔记"));
		expect(loadChildren).toHaveBeenCalledTimes(3);
		await settle();

		key(tree, "ArrowRight");
		expect(loadChildren).toHaveBeenCalledTimes(4);
		await settle();

		key(tree, "Enter");
		expect(loadChildren).toHaveBeenCalledTimes(5);
		expect(onValueChange).not.toHaveBeenCalled();
		await settle();
	});

	it("loadChildren 同步抛错也算失败；重试成功后失败标记消失", async () => {
		let attempt = 0;
		const loadChildren = vi.fn(() => {
			attempt += 1;
			if (attempt === 1) throw new Error("同步失败");
			return Promise.resolve(RUST_CHILDREN);
		});
		setup({ loadChildren });
		fireEvent.click(chevronOf("Rust 全栈笔记"));
		await settle();
		expect(row("Rust 全栈笔记").hasAttribute("data-failed")).toBe(true);
		fireEvent.click(row("Rust 全栈笔记"));
		await settle();
		expect(row("Rust 全栈笔记").hasAttribute("data-failed")).toBe(false);
		expect(labels()).toContain("第 2 章 · 异步");
	});

	it("取回空数组的节点变成叶子：没有箭头、没有 aria-expanded，不再取", async () => {
		const loadChildren = vi.fn(async () => []);
		setup({ loadChildren });
		fireEvent.click(chevronOf("Rust 全栈笔记"));
		await settle();
		expect(row("Rust 全栈笔记").hasAttribute("aria-expanded")).toBe(false);
		expect(row("Rust 全栈笔记").querySelector("[data-tree-chevron]")).toBeNull();
		fireEvent.click(row("Rust 全栈笔记"));
		expect(loadChildren).toHaveBeenCalledTimes(1);
	});

	it("没有 loadChildren 时 lazy 节点按叶子处理", () => {
		setup();
		expect(row("Rust 全栈笔记").hasAttribute("aria-expanded")).toBe(false);
		expect(row("Rust 全栈笔记").querySelector("[data-tree-chevron]")).toBeNull();
	});

	it("nodes 换了数据：缓存清空，节点回到未取回，在途请求的结果作废", async () => {
		const first = deferred<TreeNodeData[]>();
		const second = deferred<TreeNodeData[]>();
		const loadChildren = vi
			.fn<() => Promise<TreeNodeData[]>>()
			.mockReturnValueOnce(first.promise)
			.mockReturnValueOnce(second.promise);
		const nextNodes: TreeNodeData[] = DOCS.map((node) => ({ ...node }));
		const { rerender } = render(
			<Tree aria-label="t" nodes={DOCS} loadChildren={loadChildren} defaultExpanded={[]} />,
		);
		fireEvent.click(chevronOf("Rust 全栈笔记"));
		expect(loadChildren).toHaveBeenCalledTimes(1);

		rerender(<Tree aria-label="t" nodes={nextNodes} loadChildren={loadChildren} />);
		first.resolve(RUST_CHILDREN);
		await settle();
		expect(labels()).not.toContain("第 1 章 · 所有权");
		expect(row("Rust 全栈笔记").hasAttribute("aria-busy")).toBe(false);

		// 同一节点重新等待取回，用新的结果
		fireEvent.click(chevronOf("Rust 全栈笔记"));
		expect(loadChildren).toHaveBeenCalledTimes(2);
		second.resolve([{ value: "fresh", label: "新的章节" }]);
		await settle();
		expect(labels()).toContain("新的章节");
		expect(labels()).not.toContain("第 1 章 · 所有权");
	});

	it("nodes 换了数据后，已取回的缓存清空，节点重新是 lazy", async () => {
		const loadChildren = vi.fn(async () => RUST_CHILDREN);
		const { rerender } = render(
			<Tree aria-label="t" nodes={DOCS} loadChildren={loadChildren} />,
		);
		fireEvent.click(chevronOf("Rust 全栈笔记"));
		await settle();
		expect(labels()).toContain("第 1 章 · 所有权");
		rerender(
			<Tree
				aria-label="t"
				nodes={DOCS.map((node) => ({ ...node }))}
				loadChildren={loadChildren}
			/>,
		);
		expect(labels()).not.toContain("第 1 章 · 所有权");
		expect(row("Rust 全栈笔记").getAttribute("aria-expanded")).toBe("false");
		fireEvent.click(chevronOf("Rust 全栈笔记"));
		expect(loadChildren).toHaveBeenCalledTimes(2);
		await settle();
	});

	it("卸载后到达的结果被丢弃，不报错", async () => {
		const pending = deferred<TreeNodeData[]>();
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		const { unmount } = setup({ loadChildren: () => pending.promise });
		fireEvent.click(chevronOf("Rust 全栈笔记"));
		unmount();
		pending.resolve(RUST_CHILDREN);
		await settle();
		expect(spy).not.toHaveBeenCalled();
	});

	it("取回的子节点参与受控的展开与选中", async () => {
		const onValueChange = vi.fn();
		const onExpandedChange = vi.fn();
		const loadChildren = vi.fn(async () => RUST_CHILDREN);
		setup({ loadChildren, onValueChange, onExpandedChange });
		fireEvent.click(chevronOf("Rust 全栈笔记"));
		expect(onExpandedChange).toHaveBeenLastCalledWith(["rust"]);
		await settle();
		fireEvent.click(row("第 2 章 · 异步"));
		expect(onValueChange).toHaveBeenCalledWith("async");
	});
});
