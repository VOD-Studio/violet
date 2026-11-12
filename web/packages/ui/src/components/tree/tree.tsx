"use client";

import { cn } from "cn";
import { ChevronRight, File, Folder, FolderOpen } from "lucide-react";
import { useComposedRefs, useControllableState } from "radix-ui/internal";
import {
	type ComponentProps,
	type CSSProperties,
	type KeyboardEvent,
	type MouseEvent,
	type ReactNode,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { iconProps } from "../icons";
import { FlowerBloom } from "../indicator";
import { useListHighlight } from "../list-highlight/use-list-highlight";
import {
	buildTree,
	enabledParentOf,
	matchPrefix,
	type TreeNode,
	type TreeNodeData,
	type VisibleRow,
	visibleRows,
} from "./tree-model";

export type { TreeNodeData } from "./tree-model";

type LoadStatus = "loading" | "failed";

const EMPTY_LIST: string[] = [];

/** 输入字母跳行的连续输入缓冲：两次按键间隔超过它就重新开始。 */
const TYPEAHEAD_RESET_MS = 500;

const FAILED_HINT = "加载失败，点击重试";

export interface TreeProps
	extends Omit<
		ComponentProps<"div">,
		"children" | "defaultValue" | "onChange" | "role" | "tabIndex" | "aria-activedescendant"
	> {
	/** 节点树。`value` 在整棵树里必须唯一；懒加载取回的子节点同样不能重复。 */
	nodes: readonly TreeNodeData[];
	/** 当前项的 `value`；空串表示没有当前项。 */
	value?: string;
	defaultValue?: string;
	onValueChange?: (value: string) => void;
	/** 展开着的节点 `value` 数组。 */
	expanded?: string[];
	defaultExpanded?: string[];
	onExpandedChange?: (expanded: string[]) => void;
	/**
	 * 懒加载：首次展开 `lazy` 节点时调用，返回它的子节点；抛错或拒绝表示失败，点该行重试。
	 * 取回的子节点缓存在组件里，`nodes` 换了引用就清空。
	 */
	loadChildren?: (node: TreeNodeData) => Promise<readonly TreeNodeData[]>;
	/** 给没有自己 `icon` 的节点补默认图标：目录是文件夹（展开时是打开的文件夹），叶子是文件。 */
	icons?: boolean;
}

/** 行 id 里不能出现空白；字母数字与连字符之外的字符都转成码点，不同 `value` 不会撞到同一个 id。 */
function rowIdOf(baseId: string, value: string) {
	return `${baseId}-r-${value.replace(/[^A-Za-z0-9-]/g, (char) => `_${char.codePointAt(0)?.toString(16)}_`)}`;
}

function defaultIcon(isBranch: boolean, open: boolean): ReactNode {
	if (!isBranch) return <File />;
	return open ? <FolderOpen /> : <Folder />;
}

interface TreeRowProps {
	id: string;
	row: VisibleRow;
	current: boolean;
	active: boolean;
	status: LoadStatus | undefined;
	icons: boolean;
	onRowClick: (event: MouseEvent<HTMLElement>, node: TreeNode) => void;
}

function TreeRow({ id, row, current, active, status, icons, onRowClick }: TreeRowProps) {
	const { node } = row;
	const failed = status === "failed";
	const busy = status === "loading";
	// 正在取回的节点视作展开中；取回失败或换数据源后不再是目录就不报告展开
	const open = row.open && (busy || node.kind === "branch");
	const isBranch = node.kind !== "leaf";
	const meta = failed ? FAILED_HINT : node.data.meta;
	const icon =
		node.data.icon !== undefined ? node.data.icon : icons ? defaultIcon(isBranch, open) : null;

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: 焦点在树容器上，键盘操作由容器处理
		// biome-ignore lint/a11y/useFocusableInteractive: 焦点在树容器上，行用 aria-activedescendant 指向
		<div
			id={id}
			role="treeitem"
			aria-level={node.depth + 1}
			aria-posinset={node.position}
			aria-setsize={node.setSize}
			aria-expanded={isBranch ? open : undefined}
			aria-selected={current}
			aria-disabled={node.disabled || undefined}
			aria-busy={busy || undefined}
			aria-labelledby={`${id}-label`}
			aria-describedby={meta ? `${id}-meta` : undefined}
			data-slot="tree-row"
			data-list-highlight-item=""
			data-current={current ? "" : undefined}
			data-active={active ? "" : undefined}
			data-failed={failed ? "" : undefined}
			style={{ "--v-tree-depth": node.depth } as CSSProperties}
			className="v-tree__row"
			onClick={(event) => onRowClick(event, node)}
		>
			{isBranch ? (
				<span className="v-tree__chevron" data-tree-chevron="" aria-hidden="true">
					{busy ? (
						<FlowerBloom kind="plum" size={16} tone="current" />
					) : (
						<ChevronRight {...iconProps(14)} />
					)}
				</span>
			) : (
				<span className="v-tree__spacer" aria-hidden="true" />
			)}
			{icon ? (
				<span className="v-tree__icon" aria-hidden="true">
					{icon}
				</span>
			) : null}
			<span id={`${id}-label`} className="v-tree__label">
				{node.label}
			</span>
			{meta ? (
				<span id={`${id}-meta`} className="v-tree__meta">
					{meta}
				</span>
			) : null}
		</div>
	);
}

/**
 * 常驻在页面上的层级浏览树：文档目录、素材文件。选中的语义是「当前项」，不做勾选。
 *
 * 整棵树一个 Tab 位置，焦点在容器上，键盘所在的行由 `aria-activedescendant` 指出。
 *
 * @example
 * ```tsx
 * <Tree
 *   aria-label="系列目录"
 *   nodes={[{ value: "blog", label: "从零写一个博客", meta: "12 篇", children: [...] }]}
 *   value={slug}
 *   onValueChange={setSlug}
 * />
 * ```
 */
export function Tree({
	nodes,
	value: valueProp,
	defaultValue = "",
	onValueChange,
	expanded: expandedProp,
	defaultExpanded = EMPTY_LIST,
	onExpandedChange,
	loadChildren,
	icons = false,
	className,
	ref,
	onKeyDown,
	id,
	...props
}: TreeProps) {
	const baseId = useId();
	const containerRef = useRef<HTMLDivElement | null>(null);
	const highlight = useListHighlight<HTMLDivElement>();
	const composedRef = useComposedRefs(ref, containerRef, highlight.ref);

	const [current = "", setCurrent] = useControllableState<string>({
		prop: valueProp,
		defaultProp: defaultValue,
		onChange: onValueChange,
	});
	const [expandedList = EMPTY_LIST, setExpanded] = useControllableState<string[]>({
		prop: expandedProp,
		defaultProp: defaultExpanded,
		onChange: onExpandedChange,
	});
	const expandedSet = useMemo(() => new Set(expandedList), [expandedList]);
	// 异步取回完成时要拿到最新的 setter：受控时 setter 带着当时的 prop
	const setExpandedRef = useRef(setExpanded);
	setExpandedRef.current = setExpanded;

	const [loaded, setLoaded] = useState<ReadonlyMap<string, readonly TreeNodeData[]>>(
		() => new Map(),
	);
	const [status, setStatus] = useState<Readonly<Record<string, LoadStatus>>>({});
	// 取回的子节点缓存属于这份数据：nodes 换了，旧缓存与在途请求的结果都作废
	const [cacheOwner, setCacheOwner] = useState(nodes);
	if (cacheOwner !== nodes) {
		setCacheOwner(nodes);
		setLoaded(new Map());
		setStatus({});
	}
	const inflight = useRef(new Set<string>());
	const generation = useRef(0);
	// biome-ignore lint/correctness/useExhaustiveDependencies: 数据换了就是换了一代
	useEffect(() => {
		generation.current += 1;
		inflight.current.clear();
	}, [nodes]);
	const alive = useRef(true);
	useEffect(() => {
		alive.current = true;
		return () => {
			alive.current = false;
		};
	}, []);
	const loadRef = useRef(loadChildren);
	loadRef.current = loadChildren;

	const canLoad = Boolean(loadChildren);
	const tree = useMemo(() => buildTree(nodes, loaded, canLoad), [nodes, loaded, canLoad]);
	const rows = useMemo(() => visibleRows(tree.roots, expandedSet), [tree, expandedSet]);

	// 键盘所在的行：记下的行还在且可用就用它，否则回到当前项，再否则第一个可用行
	const [activeValue, setActiveValue] = useState<string | null>(null);
	const activeIndex = useMemo(() => {
		for (const wanted of [activeValue, current]) {
			const index = rows.findIndex((row) => row.node.value === wanted && !row.node.disabled);
			if (index >= 0) return index;
		}
		return rows.findIndex((row) => !row.node.disabled);
	}, [rows, activeValue, current]);
	const activeNode = rows[activeIndex]?.node ?? null;

	const scrollPending = useRef(false);
	// biome-ignore lint/correctness/useExhaustiveDependencies: 只在键盘移动后跟随一次
	useEffect(() => {
		if (!scrollPending.current) return;
		scrollPending.current = false;
		containerRef.current
			?.querySelector<HTMLElement>("[data-active]")
			?.scrollIntoView?.({ block: "nearest" });
	}, [activeNode?.value]);

	const moveTo = (index: number) => {
		const target = rows[index]?.node;
		if (!target || target.disabled) return;
		scrollPending.current = true;
		setActiveValue(target.value);
	};
	const step = (from: number, direction: 1 | -1) => {
		for (let index = from + direction; index >= 0 && index < rows.length; index += direction) {
			if (!rows[index]?.node.disabled) return index;
		}
		return -1;
	};

	const requestLoad = (node: TreeNode) => {
		const loader = loadRef.current;
		if (!loader || inflight.current.has(node.value)) return;
		inflight.current.add(node.value);
		const value = node.value;
		setStatus((state) => ({ ...state, [value]: "loading" }));
		setExpandedRef.current((list) => (list.includes(value) ? list : [...list, value]));
		const generationAtStart = generation.current;
		const finish = () => {
			if (generationAtStart !== generation.current) return false;
			inflight.current.delete(value);
			return alive.current;
		};
		let pending: Promise<readonly TreeNodeData[]>;
		try {
			pending = Promise.resolve(loader(node.data));
		} catch (error) {
			pending = Promise.reject(error);
		}
		pending.then(
			(children) => {
				if (!finish()) return;
				setLoaded((cache) => new Map(cache).set(value, children));
				setStatus(({ [value]: _done, ...rest }) => rest);
			},
			() => {
				if (!finish()) return;
				setStatus((state) => ({ ...state, [value]: "failed" }));
				setExpandedRef.current((list) => list.filter((item) => item !== value));
			},
		);
	};

	const toggleExpand = (node: TreeNode) => {
		if (node.kind === "lazy") {
			if (expandedSet.has(node.value) && status[node.value] === "loading") {
				setExpanded((list) => list.filter((item) => item !== node.value));
			} else {
				requestLoad(node);
			}
			return;
		}
		if (node.kind !== "branch") return;
		setExpanded((list) =>
			list.includes(node.value)
				? list.filter((item) => item !== node.value)
				: [...list, node.value],
		);
	};

	const activate = (node: TreeNode) => {
		if (node.disabled) return;
		if (node.kind === "lazy" && status[node.value] === "failed") {
			requestLoad(node);
			return;
		}
		setCurrent(node.value);
	};

	const handleRowClick = (event: MouseEvent<HTMLElement>, node: TreeNode) => {
		if (node.disabled) return;
		setActiveValue(node.value);
		if (event.target instanceof Element && event.target.closest("[data-tree-chevron]")) {
			toggleExpand(node);
			return;
		}
		activate(node);
	};

	const typed = useRef({ text: "", timer: 0 });
	useEffect(() => () => window.clearTimeout(typed.current.timer), []);
	const typeahead = (key: string) => {
		const buffer = typed.current;
		window.clearTimeout(buffer.timer);
		buffer.timer = window.setTimeout(() => {
			buffer.text = "";
		}, TYPEAHEAD_RESET_MS);
		buffer.text += key;
		const text = buffer.text;
		const repeated = [...text].every((char) => char.toLowerCase() === text[0]?.toLowerCase());
		// 反复按同一个字母是在同首字母的行间循环；多个字母才是前缀
		let index = text.length > 1 ? matchPrefix(rows, text, activeIndex, true) : -1;
		if (index < 0 && repeated) index = matchPrefix(rows, text[0] ?? "", activeIndex, false);
		if (index >= 0) moveTo(index);
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		onKeyDown?.(event);
		if (event.defaultPrevented || event.nativeEvent.isComposing) return;
		if (event.altKey || event.ctrlKey || event.metaKey) return;
		const node = activeNode;
		if (!node) return;
		const open = expandedSet.has(node.value) && node.kind === "branch";
		const typing = typed.current.text !== "";
		switch (event.key) {
			case "ArrowDown":
				moveTo(step(activeIndex, 1));
				break;
			case "ArrowUp":
				moveTo(step(activeIndex, -1));
				break;
			case "Home":
				moveTo(step(-1, 1));
				break;
			case "End":
				moveTo(step(rows.length, -1));
				break;
			case "ArrowRight":
				if (node.kind === "lazy") {
					if (!expandedSet.has(node.value) || status[node.value] === "failed")
						requestLoad(node);
				} else if (node.kind === "branch" && !open) {
					toggleExpand(node);
				} else if (open) {
					const first = node.children.find((child) => !child.disabled);
					if (first) {
						scrollPending.current = true;
						setActiveValue(first.value);
					}
				}
				break;
			case "ArrowLeft":
				if (open || (node.kind === "lazy" && expandedSet.has(node.value))) {
					toggleExpand(node);
				} else {
					const parent = enabledParentOf(node);
					if (parent) {
						scrollPending.current = true;
						setActiveValue(parent.value);
					}
				}
				break;
			case "Enter":
				activate(node);
				break;
			case " ":
				if (typing) typeahead(" ");
				else activate(node);
				break;
			default:
				if ([...event.key].length !== 1) return;
				typeahead(event.key);
		}
		event.preventDefault();
	};

	return (
		<div
			{...props}
			id={id}
			ref={composedRef}
			role="tree"
			tabIndex={0}
			aria-activedescendant={activeNode ? rowIdOf(baseId, activeNode.value) : undefined}
			data-slot="tree"
			className={cn("v-tree v-list-highlight", className)}
			onKeyDown={handleKeyDown}
		>
			{rows.map((row) => (
				<TreeRow
					key={row.node.value}
					id={rowIdOf(baseId, row.node.value)}
					row={row}
					current={row.node.value === current}
					active={row.node === activeNode}
					status={status[row.node.value]}
					icons={icons}
					onRowClick={handleRowClick}
				/>
			))}
		</div>
	);
}
