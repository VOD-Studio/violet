/** 级联选择的一个节点。 */
export interface CascaderOption {
	/** 节点在同级里的标识，也是 `value` 路径的一段。同级内必须唯一。 */
	value: string;
	/** 显示、搜索与读屏用的文字。 */
	label: string;
	/** 子节点；没有 `children` 又没有 `loadData` 的节点是叶子。空数组表示有子级但目前为空。 */
	children?: CascaderOption[];
	disabled?: boolean;
	/** 明确是叶子：即使有 `loadData` 也不会去加载它的子级。 */
	isLeaf?: boolean;
}

/** 按需加载子级：参数是从第一级到被展开节点的节点链，返回它的子节点；拒绝（`reject`）表示失败。 */
export type CascaderLoadData = (path: readonly CascaderOption[]) => Promise<CascaderOption[]>;

/** 已经加载好的子级，键是 `pathKey(路径)`。 */
export type LoadedChildren = ReadonlyMap<string, readonly CascaderOption[]>;

export function pathKey(path: readonly string[]): string {
	return JSON.stringify(path);
}

export function samePath(a: readonly string[], b: readonly string[]): boolean {
	return a.length === b.length && a.every((segment, index) => segment === b[index]);
}

/** `prefix` 是否是 `path` 的前缀（含相等）。 */
export function isPrefix(prefix: readonly string[], path: readonly string[]): boolean {
	return (
		prefix.length <= path.length && prefix.every((segment, index) => segment === path[index])
	);
}

/** `path` 下的子级：空路径是第一级；节点自己没有 `children` 时取已加载的；不存在返回 `undefined`。 */
export function childrenOf(
	root: readonly CascaderOption[],
	loaded: LoadedChildren,
	path: readonly string[],
): readonly CascaderOption[] | undefined {
	let nodes: readonly CascaderOption[] | undefined = root;
	for (let depth = 0; depth < path.length; depth++) {
		const node: CascaderOption | undefined = nodes?.find(
			(candidate) => candidate.value === path[depth],
		);
		if (!node) return undefined;
		nodes = node.children ?? loaded.get(pathKey(path.slice(0, depth + 1)));
	}
	return nodes;
}

/** 路径上能找到的节点链；中途找不到（如尚未加载）就在那里截断。 */
export function resolveChain(
	root: readonly CascaderOption[],
	loaded: LoadedChildren,
	path: readonly string[],
): CascaderOption[] {
	const chain: CascaderOption[] = [];
	let nodes: readonly CascaderOption[] | undefined = root;
	for (let depth = 0; depth < path.length; depth++) {
		const node: CascaderOption | undefined = nodes?.find(
			(candidate) => candidate.value === path[depth],
		);
		if (!node) break;
		chain.push(node);
		nodes = node.children ?? loaded.get(pathKey(path.slice(0, depth + 1)));
	}
	return chain;
}

/** 节点还有下一级：有 `children`、已加载过，或可以按需加载。 */
export function isBranch(
	node: CascaderOption,
	loaded: LoadedChildren,
	path: readonly string[],
	canLoad: boolean,
): boolean {
	if (node.isLeaf === true) return false;
	return node.children !== undefined || loaded.has(pathKey(path)) || canLoad;
}

export interface CascaderHit {
	path: string[];
	labels: string[];
}

/**
 * 搜索：匹配任意一级文字（不分大小写），只列叶子，路径上任何一级禁用的不列。
 * 还没加载的节点既不是叶子也看不到子级，不参与。
 */
export function searchLeaves(
	root: readonly CascaderOption[],
	loaded: LoadedChildren,
	query: string,
	canLoad: boolean,
): CascaderHit[] {
	const needle = query.trim().toLowerCase();
	if (!needle) return [];
	const hits: CascaderHit[] = [];
	const walk = (nodes: readonly CascaderOption[], path: string[], labels: string[]) => {
		for (const node of nodes) {
			if (node.disabled) continue;
			const nextPath = [...path, node.value];
			const nextLabels = [...labels, node.label];
			const children =
				node.isLeaf === true ? undefined : (node.children ?? loaded.get(pathKey(nextPath)));
			if (children !== undefined) {
				walk(children, nextPath, nextLabels);
			} else if (node.isLeaf === true || !canLoad) {
				if (nextLabels.join(" / ").toLowerCase().includes(needle)) {
					hits.push({ path: nextPath, labels: nextLabels });
				}
			}
		}
	};
	walk(root, [], []);
	return hits;
}

/** 触发器显示的路径：多于三级折成「首级 / … / 末级」。 */
export function foldLabels(labels: readonly string[]): string[] {
	return labels.length > 3 ? [labels[0], "…", labels[labels.length - 1]] : [...labels];
}
