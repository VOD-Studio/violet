import type { ReactNode } from "react";

/** 树的一个节点。`value` 在整棵树里必须唯一。 */
export interface TreeNodeData {
	value: string;
	label: string;
	children?: readonly TreeNodeData[];
	/** 有子节点但还没取回：首次展开时调用 `loadChildren`。没有 `loadChildren` 时按叶子处理。 */
	lazy?: boolean;
	/** 禁用的节点不能被选中、展开，键盘跳过它。 */
	disabled?: boolean;
	/** 16px 图标；传 `null` 表示这一行不要图标。缺省见 `Tree` 的 `icons`。 */
	icon?: ReactNode;
	/** 行右侧的 12px 次级信息，通常是篇数或字数。 */
	meta?: ReactNode;
}

/** `branch` 有子节点；`lazy` 等待取回子节点；`leaf` 没有子节点（取回为空的节点也算）。 */
export type TreeNodeKind = "leaf" | "branch" | "lazy";

export interface TreeNode {
	data: TreeNodeData;
	value: string;
	label: string;
	kind: TreeNodeKind;
	disabled: boolean;
	/** 根是 0。 */
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

export interface VisibleRow {
	node: TreeNode;
	open: boolean;
}

/**
 * 把节点数据建成带父子关系的树；`loaded` 里是已经取回的懒加载子节点，以父节点的 `value` 为键。
 * `canLoad` 为假时，`lazy` 的节点按叶子处理；节点自带 `children` 时优先于取回的结果。
 */
export function buildTree(
	nodes: readonly TreeNodeData[],
	loaded: ReadonlyMap<string, readonly TreeNodeData[]>,
	canLoad: boolean,
): TreeIndex {
	const byValue = new Map<string, TreeNode>();
	const make = (
		list: readonly TreeNodeData[],
		depth: number,
		parent: TreeNode | null,
	): TreeNode[] =>
		list.map((data, index) => {
			const node: TreeNode = {
				data,
				value: data.value,
				label: data.label,
				kind: "leaf",
				disabled: Boolean(data.disabled),
				depth,
				parent,
				children: [],
				position: index + 1,
				setSize: list.length,
			};
			const own = data.children && data.children.length > 0 ? data.children : null;
			const fetched = data.lazy && canLoad ? loaded.get(data.value) : undefined;
			const source = own ?? (fetched && fetched.length > 0 ? fetched : null);
			if (source) {
				node.kind = "branch";
				node.children = make(source, depth + 1, node);
			} else if (data.lazy && canLoad && fetched === undefined) {
				node.kind = "lazy";
			}
			if (!byValue.has(node.value)) byValue.set(node.value, node);
			return node;
		});
	return { roots: make(nodes, 0, null), byValue };
}

/** 节点的祖先，由近及远。 */
export function ancestorsOf(node: TreeNode): TreeNode[] {
	const result: TreeNode[] = [];
	for (let parent = node.parent; parent; parent = parent.parent) result.push(parent);
	return result;
}

/** 当前可见的行，先后顺序即屏幕顺序：目录在 `expanded` 里才展开它的子节点。 */
export function visibleRows(
	roots: readonly TreeNode[],
	expanded: ReadonlySet<string>,
): VisibleRow[] {
	const rows: VisibleRow[] = [];
	const walk = (nodes: readonly TreeNode[]) => {
		for (const node of nodes) {
			const open = expanded.has(node.value);
			rows.push({ node, open });
			if (open && node.kind === "branch") walk(node.children);
		}
	};
	walk(roots);
	return rows;
}

/** 最近的、没有被禁用的祖先；都被禁用或已是根时为 `null`。 */
export function enabledParentOf(node: TreeNode): TreeNode | null {
	return ancestorsOf(node).find((ancestor) => !ancestor.disabled) ?? null;
}

/**
 * typeahead：从 `from` 行（下标）起，找标签以 `prefix` 开头的第一个未禁用行，到末尾后回到开头。
 * `inclusive` 为真时 `from` 行本身也参与（连续输入多个字符时当前行可能已经匹配），否则从下一行找起。
 */
export function matchPrefix(
	rows: readonly VisibleRow[],
	prefix: string,
	from: number,
	inclusive: boolean,
): number {
	const needle = prefix.toLowerCase();
	const count = rows.length;
	for (let step = inclusive ? 0 : 1; step <= count; step++) {
		const index = (((from + step) % count) + count) % count;
		const { node } = rows[index] ?? {};
		if (node && !node.disabled && node.label.toLowerCase().startsWith(needle)) return index;
	}
	return -1;
}
