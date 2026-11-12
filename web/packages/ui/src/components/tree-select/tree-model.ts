import type { ReactNode } from "react";

/** 树选择的一个节点。`value` 在整棵树里必须唯一。 */
export interface TreeSelectOption {
	value: string;
	label: string;
	children?: readonly TreeSelectOption[];
	/** 有子节点但还没取回：首次展开时调用 `loadChildren`。没有 `loadChildren` 时按叶子处理。 */
	lazy?: boolean;
	disabled?: boolean;
	/** 16px 图标，缺省目录用文件夹（展开时是打开的文件夹）、叶子用文件。 */
	icon?: ReactNode;
	/** 行右侧的 12px 次级信息，通常是目录下的数量。 */
	meta?: ReactNode;
}

/** `branch` 有子节点；`lazy` 等待取回子节点；`leaf` 没有子节点（取回为空的节点也算）。 */
export type TreeNodeKind = "leaf" | "branch" | "lazy";

export interface TreeNode {
	option: TreeSelectOption;
	value: string;
	label: string;
	kind: TreeNodeKind;
	disabled: boolean;
	depth: number;
	parent: TreeNode | null;
	children: TreeNode[];
	/** 在同级里的位置（从 1 起）与同级总数，给 `aria-posinset`、`aria-setsize`。 */
	position: number;
	setSize: number;
}

export interface TreeIndex {
	roots: TreeNode[];
	byValue: ReadonlyMap<string, TreeNode>;
}

export type CheckState = "none" | "some" | "all";

export interface VisibleRow {
	node: TreeNode;
	open: boolean;
}

/**
 * 把选项树建成带父子关系的节点；`loaded` 里是已经取回的懒加载子节点，以父节点的 `value` 为键。
 * `canLoad` 为假时，`lazy` 的节点按叶子处理。
 */
export function buildTree(
	options: readonly TreeSelectOption[],
	loaded: ReadonlyMap<string, readonly TreeSelectOption[]>,
	canLoad: boolean,
): TreeIndex {
	const byValue = new Map<string, TreeNode>();
	const make = (
		list: readonly TreeSelectOption[],
		depth: number,
		parent: TreeNode | null,
	): TreeNode[] =>
		list.map((option, index) => {
			const node: TreeNode = {
				option,
				value: option.value,
				label: option.label,
				kind: "leaf",
				disabled: Boolean(option.disabled),
				depth,
				parent,
				children: [],
				position: index + 1,
				setSize: list.length,
			};
			const own = option.children && option.children.length > 0 ? option.children : null;
			const fetched = option.lazy && canLoad ? loaded.get(option.value) : undefined;
			const source = own ?? (fetched && fetched.length > 0 ? fetched : null);
			if (source) {
				node.kind = "branch";
				node.children = make(source, depth + 1, node);
			} else if (option.lazy && canLoad && fetched === undefined) {
				node.kind = "lazy";
			}
			if (!byValue.has(node.value)) byValue.set(node.value, node);
			return node;
		});
	return { roots: make(options, 0, null), byValue };
}

/** 节点之下（含自身）的叶子，按树的先后顺序。尚未取回的懒节点没有叶子。 */
export function leavesOf(node: TreeNode): TreeNode[] {
	if (node.kind === "leaf") return [node];
	return node.children.flatMap(leavesOf);
}

/** 节点的祖先，由近及远。 */
export function ancestorsOf(node: TreeNode): TreeNode[] {
	const result: TreeNode[] = [];
	for (let parent = node.parent; parent; parent = parent.parent) result.push(parent);
	return result;
}

/**
 * 每个节点的勾选三态。目录的状态只看「有意义的叶子」：可选的叶子，加上已选中的禁用叶子；
 * 没有这样的叶子，状态是 `none`。叶子自己选中即 `all`。
 */
export function computeStates(
	roots: readonly TreeNode[],
	selected: ReadonlySet<string>,
): Map<string, CheckState> {
	const states = new Map<string, CheckState>();
	const walk = (node: TreeNode): { total: number; checked: number } => {
		let total = 0;
		let checked = 0;
		if (node.kind === "leaf") {
			const isChecked = selected.has(node.value);
			if (!node.disabled || isChecked) {
				total = 1;
				checked = isChecked ? 1 : 0;
			}
		} else {
			for (const child of node.children) {
				const part = walk(child);
				total += part.total;
				checked += part.checked;
			}
		}
		states.set(
			node.value,
			total === 0 || checked === 0 ? "none" : checked === total ? "all" : "some",
		);
		return { total, checked };
	};
	for (const root of roots) walk(root);
	return states;
}

/** 「覆盖最少节点」：选满的目录只留目录本身，部分选中的目录往下找，没选的跳过。 */
export function coverNodes(
	roots: readonly TreeNode[],
	states: ReadonlyMap<string, CheckState>,
): TreeNode[] {
	const result: TreeNode[] = [];
	const visit = (node: TreeNode) => {
		const state = states.get(node.value);
		if (state === "all") result.push(node);
		else if (state === "some") node.children.forEach(visit);
	};
	roots.forEach(visit);
	return result;
}

/**
 * 勾选或取消一个节点：它之下的可选叶子全部已选就全部取消，否则全部选上。
 * 禁用节点、没有可选叶子的节点不动；已选中的禁用叶子不会被动到。没有变化时原样返回传入的数组。
 */
export function toggleNode(node: TreeNode, selected: string[]): string[] {
	if (node.disabled) return selected;
	const targets = leavesOf(node)
		.filter((leaf) => !leaf.disabled)
		.map((leaf) => leaf.value);
	if (targets.length === 0) return selected;
	const current = new Set(selected);
	if (targets.every((value) => current.has(value))) {
		const removed = new Set(targets);
		return selected.filter((value) => !removed.has(value));
	}
	return [...selected, ...targets.filter((value) => !current.has(value))];
}

/**
 * 取消节点之下的全部叶子，含已选中的禁用叶子（芯片的移除钮用：芯片覆盖的范围里有它们）。
 * 行上的勾选仍不会动禁用叶子。没有变化时原样返回传入的数组。
 */
export function removeNode(node: TreeNode, selected: string[]): string[] {
	const removed = new Set(leavesOf(node).map((leaf) => leaf.value));
	return selected.some((value) => removed.has(value))
		? selected.filter((value) => !removed.has(value))
		: selected;
}

/**
 * 当前可见的行，先后顺序即屏幕顺序。
 * 有搜索词时只留下匹配的节点与它们的祖先，祖先强制展开，用户记下的展开状态不动；
 * 没有搜索词时按 `expanded` 展开。
 */
export function visibleRows(
	roots: readonly TreeNode[],
	expanded: ReadonlySet<string>,
	query: string,
): VisibleRow[] {
	const needle = query.trim().toLowerCase();
	let keep: Set<string> | null = null;
	let forced: Set<string> | null = null;
	if (needle) {
		const kept = new Set<string>();
		const auto = new Set<string>();
		const scan = (node: TreeNode) => {
			if (node.label.toLowerCase().includes(needle)) {
				kept.add(node.value);
				for (const ancestor of ancestorsOf(node)) {
					kept.add(ancestor.value);
					auto.add(ancestor.value);
				}
			}
			node.children.forEach(scan);
		};
		roots.forEach(scan);
		keep = kept;
		forced = auto;
	}
	const rows: VisibleRow[] = [];
	const walk = (nodes: readonly TreeNode[]) => {
		for (const node of nodes) {
			if (keep && !keep.has(node.value)) continue;
			const open = forced ? forced.has(node.value) : expanded.has(node.value);
			rows.push({ node, open });
			if (open && node.kind === "branch") walk(node.children);
		}
	};
	walk(roots);
	return rows;
}
