"use client";

import { cn } from "cn";
import { Check, ChevronDown, ChevronRight, RotateCw, Search, X } from "lucide-react";
import { useControllableState } from "radix-ui/internal";
import {
	type CSSProperties,
	type FocusEvent,
	Fragment,
	type KeyboardEvent,
	type PointerEvent,
	type ReactNode,
	useEffect,
	useId,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { highlightMatch, PickerEmpty, PickerOption, PickerPanel } from "../../lib/picker-panel";
import { Spinner } from "../indicator";
import { type InputVariantProps, inputVariants } from "../input/styles";
import { useListHighlight } from "../list-highlight/use-list-highlight";
import {
	type CascaderHit,
	type CascaderLoadData,
	type CascaderOption,
	childrenOf,
	foldLabels,
	isBranch,
	isPrefix,
	type LoadedChildren,
	pathKey,
	resolveChain,
	samePath,
	searchLeaves,
} from "./model";

export type { CascaderLoadData, CascaderOption } from "./model";

const EMPTY: string[] = [];
const HOVER_EXPAND_MS = 120;
const NAVIGATION_KEYS = [
	"ArrowDown",
	"ArrowUp",
	"ArrowLeft",
	"ArrowRight",
	"Home",
	"End",
	"Enter",
	" ",
];
const COARSE_POINTER = "(pointer: coarse)";

function subscribeCoarse(notify: () => void) {
	if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
	const query = window.matchMedia(COARSE_POINTER);
	query.addEventListener("change", notify);
	return () => query.removeEventListener("change", notify);
}

function coarseSnapshot() {
	return typeof window !== "undefined" && typeof window.matchMedia === "function"
		? window.matchMedia(COARSE_POINTER).matches
		: false;
}

function noCoarsePointer() {
	return false;
}

type LoadStatus = "loading" | "error";

interface PanelState {
	/** 键盘光标所在行的路径；没有为空。 */
	active: string[];
	/** 下一列已展开的那条路径：它每一级的子级各占一列。 */
	expanded: string[];
}

interface Column {
	path: string[];
	/** `null` 表示这一列的子级正在加载。 */
	nodes: readonly CascaderOption[] | null;
}

export interface CascaderProps extends InputVariantProps {
	/** 选项树。 */
	options: CascaderOption[];
	/** 选中的路径：从第一级到所选节点每一级的 `value`；空数组表示没有选择。 */
	value?: string[];
	defaultValue?: string[];
	/** 选择变化时调用：`path` 是路径，`options` 是路径上能解析到的节点链；清除时都是空数组。 */
	onValueChange?: (path: string[], options: CascaderOption[]) => void;
	/** 每一级都可以选：点击同时展开并选中，再点已选中的行取消选择。默认只能选叶子。 */
	changeOnSelect?: boolean;
	/** 按需加载：没有 `children`、也没有标 `isLeaf` 的节点首次展开时调用。 */
	loadData?: CascaderLoadData;
	/** 触发器变成输入框，输入时面板列出匹配的完整路径。 */
	searchable?: boolean;
	/** 没有选择时的占位文字，默认「请选择」。 */
	placeholder?: string;
	/** 搜索输入框的占位文字，默认「搜索路径」。 */
	searchPlaceholder?: string;
	/** 第一级没有选项时的内容，默认「无选项」。 */
	empty?: ReactNode;
	/** 表单字段名；选中后每一级渲染一个同名隐藏输入，按层级顺序提交，没有选择就不提交。 */
	name?: string;
	/** 隐藏输入所属表单的 id，对应原生 `form` 属性。 */
	form?: string;
	disabled?: boolean;
	/** 只读：可聚焦、可读屏，但不能展开，也没有箭头。 */
	readOnly?: boolean;
	/** 写入 `aria-required`；隐藏输入不参与原生必填校验。 */
	required?: boolean;
	/** 触发器显示加载指示并设 `aria-busy`。 */
	loading?: boolean;
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	/** 出错外观，并写入 `aria-invalid`；显式值优先于传入的 `aria-invalid`。 */
	invalid?: boolean;
	/** 通过外观（成功色），只是视觉反馈。 */
	valid?: boolean;
	/** 挂载面板的容器；默认 `document.body`。陈列室舞台与带缩放的宿主需要传入。 */
	container?: HTMLElement | null;
	/** 判断「放不下」的边界，默认视口。 */
	collisionBoundary?: Element | null;
	/** 加在面板上，如限制最大宽度。 */
	contentClassName?: string;
	/** 落在可聚焦元素（触发器按钮，`searchable` 时是输入框）上，表单项的标签 `for` 才命中它。 */
	id?: string;
	/** 加在外壳上。 */
	className?: string;
	style?: CSSProperties;
	"aria-label"?: string;
	"aria-labelledby"?: string;
	"aria-describedby"?: string;
	"aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling";
}

function isInvalid(invalid: boolean | undefined, ariaInvalid: CascaderProps["aria-invalid"]) {
	return (
		invalid ??
		(ariaInvalid === true ||
			ariaInvalid === "true" ||
			ariaInvalid === "grammar" ||
			ariaInvalid === "spelling")
	);
}

function PathText({ labels }: { labels: readonly string[] }) {
	const parts = foldLabels(labels);
	return parts.map((part, index) => (
		<Fragment key={parts.slice(0, index + 1).join("\u0000")}>
			{index > 0 ? <span className="v-cascader-sep"> / </span> : null}
			{part}
		</Fragment>
	));
}

interface ColumnViewProps {
	column: Column;
	depth: number;
	model: PanelModel;
}

/** 面板需要的全部数据与回调，由 `Cascader` 在每次渲染时整理。 */
interface PanelModel {
	uid: string;
	options: CascaderOption[];
	loaded: LoadedChildren;
	status: Readonly<Record<string, LoadStatus>>;
	canLoad: boolean;
	value: string[];
	active: string[];
	expanded: string[];
	mode: "keyboard" | "pointer";
	empty: ReactNode;
	query: string;
	hits: CascaderHit[];
	searchIndex: number;
	rowId: (depth: number, index: number) => string;
	hitId: (index: number) => string;
	onRowClick: (path: string[], node: CascaderOption) => void;
	onRowEnter: (event: PointerEvent<HTMLElement>, path: string[], node: CascaderOption) => void;
	onRowLeave: () => void;
	onHitClick: (hit: CascaderHit) => void;
	onHitMove: (index: number) => void;
}

function ColumnView({ column, depth, model }: ColumnViewProps) {
	const highlight = useListHighlight<HTMLDivElement>();
	const { nodes } = column;
	return (
		<div
			data-slot="cascader-column"
			ref={highlight.ref}
			role="group"
			aria-label={`第 ${depth + 1} 级`}
			data-mode={model.mode}
			className="v-cascader-col v-list-highlight"
		>
			{nodes === null ? (
				<PickerEmpty role="status">
					<Spinner size={16} aria-hidden="true" />
					加载中…
				</PickerEmpty>
			) : nodes.length === 0 ? (
				<PickerEmpty>{depth === 0 ? model.empty : "没有子项"}</PickerEmpty>
			) : (
				nodes.map((node, index) => {
					const path = [...column.path, node.value];
					const branch = isBranch(node, model.loaded, path, model.canLoad);
					const state = model.status[pathKey(path)];
					const chosen = samePath(model.value, path);
					const open =
						branch && model.expanded.length > depth && isPrefix(path, model.expanded);
					const inValue = isPrefix(path, model.value);
					const expandedPath = isPrefix(path, model.expanded);
					const onPath = expandedPath || inValue;
					const bold =
						expandedPath || (model.mode === "keyboard" && samePath(path, model.active));
					const keyboard = model.mode === "keyboard" && samePath(path, model.active);
					return (
						<PickerOption
							key={node.value}
							id={model.rowId(depth, index)}
							role="treeitem"
							aria-level={depth + 1}
							aria-setsize={nodes.length}
							aria-posinset={index + 1}
							aria-expanded={branch ? open : undefined}
							aria-selected={chosen}
							aria-disabled={node.disabled || undefined}
							aria-busy={state === "loading" || undefined}
							data-kb={keyboard ? "" : undefined}
							data-on-path={onPath ? "" : undefined}
							data-error={state === "error" ? "" : undefined}
							selected={bold || chosen}
							className="v-cascader-row"
							onClick={() => model.onRowClick(path, node)}
							onPointerEnter={(event) => model.onRowEnter(event, path, node)}
							onPointerLeave={model.onRowLeave}
							meta={
								<span className="v-cascader-end" aria-hidden="true">
									{chosen ? <Check className="v-cascader-check" /> : null}
									{state === "loading" ? (
										<Spinner size={16} />
									) : state === "error" ? (
										<RotateCw />
									) : branch ? (
										<ChevronRight />
									) : null}
								</span>
							}
						>
							{node.label}
							{state === "error" ? (
								<span className="v-cascader-sr">，加载失败，点击重试</span>
							) : null}
						</PickerOption>
					);
				})
			)}
		</div>
	);
}

function SearchResults({ model }: { model: PanelModel }) {
	const highlight = useListHighlight<HTMLDivElement>();
	return (
		<div
			data-slot="cascader-results"
			ref={highlight.ref}
			role="group"
			aria-label="搜索结果"
			data-mode={model.mode}
			className="v-cascader-col v-cascader-col--results v-list-highlight"
		>
			{model.hits.length === 0 ? (
				<PickerEmpty>无匹配的路径</PickerEmpty>
			) : (
				model.hits.map((hit, index) => {
					const chosen = samePath(model.value, hit.path);
					return (
						<PickerOption
							key={pathKey(hit.path)}
							id={model.hitId(index)}
							role="treeitem"
							aria-selected={chosen}
							data-kb={
								model.mode === "keyboard" && index === model.searchIndex
									? ""
									: undefined
							}
							selected={chosen}
							className="v-cascader-row"
							onClick={() => model.onHitClick(hit)}
							onPointerMove={() => model.onHitMove(index)}
							meta={
								chosen ? (
									<span className="v-cascader-end" aria-hidden="true">
										<Check className="v-cascader-check" />
									</span>
								) : null
							}
						>
							{highlightMatch(hit.labels.join(" / "), model.query)}
						</PickerOption>
					);
				})
			)}
		</div>
	);
}

/**
 * 级联选择：按层级逐列选一条路径，如「栏目 / 系列 / 章节」。触发器复用输入框外壳，选中后显示完整路径
 * （多于三级折成「首级 / … / 末级」，完整路径放在 `title` 与读屏文字里）。
 *
 * 焦点始终在触发器上，键盘光标由 `aria-activedescendant` 指向；面板是 `role="tree"`，
 * 每列是一个 `role="group"`，行是 `role="treeitem"`。默认只有叶子能选，`changeOnSelect` 让每一级都能选；
 * `loadData` 让子级按需加载；`searchable` 把触发器换成输入框并按完整路径搜索。
 */
export function Cascader(props: CascaderProps) {
	const {
		options,
		value: valueProp,
		defaultValue,
		onValueChange,
		changeOnSelect = false,
		loadData,
		searchable = false,
		placeholder = "请选择",
		searchPlaceholder = "搜索路径",
		empty = "无选项",
		name,
		form,
		disabled = false,
		readOnly = false,
		required = false,
		loading = false,
		open: openProp,
		defaultOpen = false,
		onOpenChange,
		variant,
		controlSize,
		invalid,
		valid = false,
		container,
		collisionBoundary,
		contentClassName,
		id,
		className,
		style,
		"aria-label": ariaLabel,
		"aria-labelledby": ariaLabelledBy,
		"aria-describedby": ariaDescribedBy,
		"aria-invalid": ariaInvalid,
	} = props;

	const uid = useId();
	const treeId = `${uid}-tree`;
	const triggerRef = useRef<HTMLButtonElement | HTMLInputElement | null>(null);
	const anchorRef = useRef<HTMLElement | null>(null);
	const treeRef = useRef<HTMLDivElement | null>(null);
	const canLoad = loadData !== undefined;

	const [inner, setInner] = useState<string[]>(defaultValue ?? EMPTY);
	const controlled = valueProp !== undefined;
	const value = valueProp ?? inner;

	const [openState = false, setOpenState] = useControllableState({
		prop: openProp,
		defaultProp: defaultOpen,
		onChange: onOpenChange,
	});
	const open = openState && !disabled && !readOnly;

	const [mode, setMode] = useState<"keyboard" | "pointer">("pointer");
	const [panel, setPanel] = useState<PanelState>({ active: EMPTY, expanded: EMPTY });
	const [query, setQuery] = useState("");
	const [searchIndex, setSearchIndex] = useState(0);
	const [loaded, setLoaded] = useState<LoadedChildren>(() => new Map());
	const [status, setStatus] = useState<Readonly<Record<string, LoadStatus>>>({});
	const [panelPresent, setPanelPresent] = useState(false);
	const drill = useSyncExternalStore(subscribeCoarse, coarseSnapshot, noCoarsePointer);

	const mounted = useRef(false);
	const inflight = useRef(new Set<string>());
	const enterOnLoad = useRef<string | null>(null);
	const hoverTimer = useRef<number | undefined>(undefined);
	const modeRef = useRef(mode);
	modeRef.current = mode;
	const pointerAt = useRef<{ x: number; y: number } | null>(null);

	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
			clearTimeout(hoverTimer.current);
		};
	}, []);

	const chain = resolveChain(options, loaded, value);
	const labels = value.map((segment, index) => chain[index]?.label ?? segment);
	const hasValue = value.length > 0;
	const fullText = labels.join(" / ");

	// 展开时重建面板状态：光标与展开路径回到已选路径；键盘展开且没有已选项时光标落在第一个可用项。
	// 搜索词只在收起时清空：输入本身就能展开面板，此时它已经带着第一个字符。
	// 初值取 false：一开始就展开（open、defaultOpen）也在首帧渲染前建立面板状态
	const [prevOpen, setPrevOpen] = useState(false);
	if (open !== prevOpen) {
		setPrevOpen(open);
		if (open) {
			const selected = chain.length === value.length ? value : EMPTY;
			const first = options.find((node) => !node.disabled);
			setPanel({
				active:
					selected.length === 0 && mode === "keyboard" && first
						? [first.value]
						: selected,
				expanded: selected.slice(0, -1),
			});
		} else {
			setQuery("");
			setSearchIndex(0);
			setPanel({ active: EMPTY, expanded: EMPTY });
		}
	}

	const setOpen = (next: boolean, nextMode: "keyboard" | "pointer" = "pointer") => {
		if (next && (disabled || readOnly)) return;
		setMode(nextMode);
		setOpenState(next);
	};

	const commit = (path: string[]) => {
		if (samePath(path, value)) return;
		if (!controlled) setInner(path);
		onValueChange?.(path, resolveChain(options, loaded, path));
	};

	const closeToTrigger = () => {
		setOpenState(false);
		triggerRef.current?.focus({ preventScroll: true });
	};

	const patchStatus = (key: string, next: LoadStatus | undefined) =>
		setStatus((current) => {
			if (next === undefined) {
				const { [key]: _removed, ...rest } = current;
				return rest;
			}
			return { ...current, [key]: next };
		});

	const startLoad = async (path: string[]) => {
		const key = pathKey(path);
		if (!loadData || inflight.current.has(key)) return;
		inflight.current.add(key);
		patchStatus(key, "loading");
		try {
			const children = await loadData(resolveChain(options, loaded, path));
			if (!mounted.current) return;
			setLoaded((current) => new Map(current).set(key, children));
			patchStatus(key, undefined);
			if (enterOnLoad.current === key) {
				enterOnLoad.current = null;
				const first = children.find((node) => !node.disabled);
				setPanel((current) =>
					first && samePath(current.expanded, path) && samePath(current.active, path)
						? { active: [...path, first.value], expanded: current.expanded }
						: current,
				);
			}
		} catch {
			if (!mounted.current) return;
			if (enterOnLoad.current === key) enterOnLoad.current = null;
			patchStatus(key, "error");
		} finally {
			inflight.current.delete(key);
		}
	};

	const nodeAt = (path: string[]) =>
		childrenOf(options, loaded, path.slice(0, -1))?.find(
			(node) => node.value === path[path.length - 1],
		);
	const branchAt = (path: string[], node: CascaderOption) =>
		isBranch(node, loaded, path, canLoad);

	/** 光标落到 `path`；有下一级就展开它（`load` 允许为此发起加载），否则只收起更深的列。 */
	const focusRow = (path: string[], load: boolean) => {
		const node = nodeAt(path);
		if (node && branchAt(path, node)) {
			const ready = childrenOf(options, loaded, path) !== undefined;
			if (ready || load) {
				setPanel({ active: path, expanded: path });
				if (!ready) void startLoad(path);
				return;
			}
		}
		setPanel({ active: path, expanded: path.slice(0, -1) });
	};
	const focusRowRef = useRef(focusRow);
	focusRowRef.current = focusRow;

	/** 进入下一列：光标落到它的第一个可用项；子级还没加载时先加载，加载完再落。 */
	const descend = (path: string[]) => {
		const node = nodeAt(path);
		if (!node || node.disabled || !branchAt(path, node)) return;
		const children = childrenOf(options, loaded, path);
		if (children === undefined) {
			enterOnLoad.current = pathKey(path);
			setPanel({ active: path, expanded: path });
			void startLoad(path);
			return;
		}
		const first = children.find((child) => !child.disabled);
		setPanel({ active: first ? [...path, first.value] : path, expanded: path });
	};

	const onRowClick = (path: string[], node: CascaderOption) => {
		if (node.disabled) return;
		if (!branchAt(path, node)) {
			commit(path);
			closeToTrigger();
			return;
		}
		if (changeOnSelect) commit(samePath(value, path) ? EMPTY : path);
		focusRow(path, true);
	};

	const onRowEnter = (event: PointerEvent<HTMLElement>, path: string[], node: CascaderOption) => {
		clearTimeout(hoverTimer.current);
		if (event.pointerType === "touch" || node.disabled) return;
		const last = pointerAt.current;
		// 列滚动时行从静止的指针下划过也会触发 enter，只认真正移动过的指针
		if (last && last.x === event.clientX && last.y === event.clientY) return;
		// 读屏光标跟着指针所指的行，不改展开路径与选值
		setPanel((current) =>
			samePath(current.active, path) ? current : { ...current, active: path },
		);
		if (!branchAt(path, node) || samePath(panel.expanded, path)) return;
		if (childrenOf(options, loaded, path) === undefined) return;
		hoverTimer.current = window.setTimeout(() => {
			if (modeRef.current === "pointer") focusRowRef.current(path, false);
		}, HOVER_EXPAND_MS);
	};

	const onRowLeave = () => clearTimeout(hoverTimer.current);

	useEffect(() => {
		if (!open) clearTimeout(hoverTimer.current);
	}, [open]);

	const searching = searchable && query.trim() !== "";
	const hits = searching ? searchLeaves(options, loaded, query, canLoad) : [];
	const clampedIndex = Math.min(searchIndex, Math.max(0, hits.length - 1));

	const columns: Column[] = [{ path: EMPTY, nodes: options }];
	for (let depth = 0; depth < panel.expanded.length; depth++) {
		const path = panel.expanded.slice(0, depth + 1);
		const nodes = childrenOf(options, loaded, path);
		if (nodes) columns.push({ path, nodes });
		else if (status[pathKey(path)] === "loading") columns.push({ path, nodes: null });
		else break;
	}

	const rowId = (depth: number, index: number) => `${uid}-c${depth}-${index}`;
	const hitId = (index: number) => `${uid}-s${index}`;
	let activeId: string | undefined;
	if (open) {
		if (searching) {
			activeId = hits.length > 0 ? hitId(clampedIndex) : undefined;
		} else if (panel.active.length > 0) {
			const depth = panel.active.length - 1;
			const index =
				columns[depth]?.nodes?.findIndex((node) => node.value === panel.active[depth]) ??
				-1;
			activeId = index >= 0 ? rowId(depth, index) : undefined;
		}
	}

	const visibleColumns = drill ? columns.slice(-1) : columns;
	const firstVisibleDepth = drill ? columns.length - 1 : 0;

	// 键盘移动的光标滚进可见处；新列出现时面板横向滚到最右
	useEffect(() => {
		if (!open || mode !== "keyboard" || !activeId) return;
		document
			.getElementById(activeId)
			?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
	}, [open, mode, activeId]);

	const columnCount = columns.length;
	// biome-ignore lint/correctness/useExhaustiveDependencies: 列数变化时才需要横向滚动
	useEffect(() => {
		const tree = treeRef.current;
		if (open && tree) tree.scrollLeft = tree.scrollWidth;
	}, [open, columnCount, drill]);

	// 面板定位完成后，把每一列里路径上的行滚到列中间
	const centerPath = () => {
		const tree = treeRef.current;
		if (!tree) return;
		for (const column of tree.querySelectorAll<HTMLElement>(".v-cascader-col")) {
			const row = column.querySelector<HTMLElement>("[data-on-path]");
			if (row)
				column.scrollTop = row.offsetTop - (column.clientHeight - row.offsetHeight) / 2;
		}
	};

	const moveActive = (to: "next" | "prev" | "first" | "last") => {
		const parent = panel.active.slice(0, -1);
		const list = childrenOf(options, loaded, parent) ?? [];
		const enabled: number[] = [];
		list.forEach((node, index) => {
			if (!node.disabled) enabled.push(index);
		});
		if (enabled.length === 0) return;
		const current =
			panel.active.length > 0
				? list.findIndex((node) => node.value === panel.active[panel.active.length - 1])
				: -1;
		let target: number;
		if (to === "first") target = enabled[0];
		else if (to === "last") target = enabled[enabled.length - 1];
		else if (to === "next")
			target = current < 0 ? enabled[0] : (enabled.find((i) => i > current) ?? current);
		else
			target =
				current < 0
					? enabled[enabled.length - 1]
					: ([...enabled].reverse().find((i) => i < current) ?? current);
		focusRow([...parent, list[target].value], false);
	};

	const onTreeKey = (event: KeyboardEvent<HTMLElement>) => {
		const { key } = event;
		const activeNode = panel.active.length > 0 ? nodeAt(panel.active) : undefined;
		switch (key) {
			case "ArrowDown":
				event.preventDefault();
				moveActive("next");
				break;
			case "ArrowUp":
				event.preventDefault();
				moveActive("prev");
				break;
			case "Home":
				event.preventDefault();
				moveActive("first");
				break;
			case "End":
				event.preventDefault();
				moveActive("last");
				break;
			case "ArrowRight":
				event.preventDefault();
				if (panel.active.length === 0) moveActive("first");
				else descend(panel.active);
				break;
			case "ArrowLeft":
				if (panel.active.length > 1) {
					event.preventDefault();
					focusRow(panel.active.slice(0, -1), false);
				}
				break;
			case "Enter":
			case " ": {
				if (key === " " && searchable) return;
				event.preventDefault();
				if (!activeNode || activeNode.disabled) return;
				if (!branchAt(panel.active, activeNode)) {
					commit(panel.active);
					closeToTrigger();
				} else if (key === "Enter" && changeOnSelect) {
					commit(panel.active);
					closeToTrigger();
				} else {
					descend(panel.active);
				}
				break;
			}
		}
	};

	const onSearchKey = (event: KeyboardEvent<HTMLElement>) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setSearchIndex(Math.min(hits.length - 1, clampedIndex + 1));
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			setSearchIndex(Math.max(0, clampedIndex - 1));
		} else if (event.key === "Enter") {
			event.preventDefault();
			const hit = hits[clampedIndex];
			if (!hit) return;
			commit(hit.path);
			closeToTrigger();
		}
	};

	const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
		if (disabled || readOnly || event.defaultPrevented) return;
		if (event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) return;
		if (!open) {
			if (
				["Enter", "ArrowDown", "ArrowUp"].includes(event.key) ||
				(event.key === " " && !searchable)
			) {
				event.preventDefault();
				setOpen(true, "keyboard");
			}
			return;
		}
		if (event.key === "Escape") {
			event.preventDefault();
			closeToTrigger();
			return;
		}
		if (event.key === "Tab") {
			// 去下一个控件：关闭但不还焦点
			setOpenState(false);
			return;
		}
		if (NAVIGATION_KEYS.includes(event.key)) clearTimeout(hoverTimer.current);
		if (NAVIGATION_KEYS.includes(event.key)) setMode("keyboard");
		if (searching) onSearchKey(event);
		else onTreeKey(event);
	};

	// 空格的点击在 keyup 才发生，展开或选择已经由 keydown 完成，这里拦掉避免立刻又收起
	const onKeyUp = (event: KeyboardEvent<HTMLElement>) => {
		if (event.key === " ") event.preventDefault();
	};

	const closeOnBlurOutside = (event: FocusEvent<HTMLElement>) => {
		if (!open) return;
		const next = event.relatedTarget;
		if (next instanceof Node) {
			if (anchorRef.current?.contains(next)) return;
			if (next instanceof Element && next.closest("[data-slot=picker-panel]")) return;
		}
		setOpenState(false);
	};

	// 表单复位：回到 defaultValue（没给则回到空）；事件被取消时不复位
	const resetRef = useRef<() => void>(() => {});
	resetRef.current = () => commit(defaultValue ?? EMPTY);
	// 监听的表单不依赖隐藏输入是否存在：清空后隐藏输入全部卸载，外置表单靠 form id 定位
	useEffect(() => {
		const byId = form ? document.getElementById(form) : null;
		const owner =
			byId instanceof HTMLFormElement ? byId : (triggerRef.current?.closest("form") ?? null);
		if (!owner) return;
		const onReset = (event: Event) => {
			setTimeout(() => {
				if (!event.defaultPrevented) resetRef.current();
			}, 0);
		};
		owner.addEventListener("reset", onReset);
		return () => owner.removeEventListener("reset", onReset);
	}, [form]);

	const invalidState = isInvalid(invalid, ariaInvalid);
	const validState = valid && !invalidState;
	const stateAttrs = {
		"data-state": open ? "open" : "closed",
		"data-invalid": invalidState ? "" : undefined,
		"data-valid": validState ? "" : undefined,
		"data-disabled": disabled ? "" : undefined,
		"data-readonly": readOnly ? "" : undefined,
		"data-loading": loading ? "" : undefined,
	};
	const shared = {
		id,
		"aria-label": ariaLabel,
		"aria-labelledby": ariaLabelledBy,
		"aria-describedby": ariaDescribedBy,
		"aria-invalid": invalid === undefined ? ariaInvalid : invalid,
		"aria-required": required || undefined,
		"aria-readonly": readOnly || undefined,
		"aria-busy": loading || undefined,
		"aria-haspopup": "tree" as const,
		"aria-expanded": open,
		"aria-controls": treeId,
		"aria-activedescendant": activeId,
		role: "combobox" as const,
		disabled,
		onKeyDown,
		onKeyUp,
		onBlur: closeOnBlurOutside,
	};
	const shellClass = inputVariants({
		variant,
		controlSize,
		className: cn("v-cascader-trigger", className),
	});
	const folded = labels.length > 3;

	const status16 = loading ? (
		<span className="v-input-control__status" data-status="loading">
			<Spinner size={16} aria-hidden="true" />
		</span>
	) : null;

	let trigger: ReactNode;
	if (searchable) {
		const editable = !disabled && !readOnly;
		trigger = (
			// biome-ignore lint/a11y/useKeyWithClickEvents: 外壳空白处的点击只是输入框的放大热区，键盘走输入框
			<div
				data-slot="cascader-trigger"
				{...stateAttrs}
				ref={(node) => {
					anchorRef.current = node;
				}}
				style={style}
				className={cn(shellClass, "v-cascader-trigger--search")}
				onMouseDown={(event) => {
					if (event.button !== 0 || disabled) return;
					if ((event.target as Element).closest("button, input")) return;
					event.preventDefault();
					triggerRef.current?.focus({ preventScroll: true });
				}}
				onClick={(event) => {
					if ((event.target as Element).closest("button")) return;
					if (!open) setOpen(true, "pointer");
				}}
			>
				<span className="v-input-control__leading" aria-hidden="true">
					<Search />
				</span>
				<input
					{...shared}
					ref={(node) => {
						triggerRef.current = node;
					}}
					type="text"
					className="v-input"
					autoComplete="off"
					spellCheck={false}
					readOnly={readOnly}
					value={open ? query : fullText}
					placeholder={open && hasValue ? fullText : searchPlaceholder}
					title={folded ? fullText : undefined}
					onChange={(event) => {
						const typed = event.target.value;
						setQuery(
							!open && typed.startsWith(fullText)
								? typed.slice(fullText.length)
								: typed,
						);
						setSearchIndex(0);
						if (!open) setOpen(true, "keyboard");
					}}
				/>
				{editable && hasValue ? (
					<button
						type="button"
						className="v-input-control__action v-input-control__action--clear"
						aria-label="清除"
						onMouseDown={(event) => event.preventDefault()}
						onClick={() => {
							commit(EMPTY);
							setQuery("");
							triggerRef.current?.focus({ preventScroll: true });
						}}
					>
						<X aria-hidden="true" />
					</button>
				) : null}
				{status16}
			</div>
		);
	} else {
		trigger = (
			<button
				data-slot="cascader-trigger"
				{...shared}
				{...stateAttrs}
				ref={(node) => {
					triggerRef.current = node;
					anchorRef.current = node;
				}}
				type="button"
				style={style}
				className={shellClass}
				title={folded ? fullText : undefined}
				onClick={() => {
					if (disabled || readOnly) return;
					// Safari 点按钮不聚焦，键盘操作需要焦点在触发器上
					triggerRef.current?.focus({ preventScroll: true });
					setOpen(!open, "pointer");
				}}
			>
				<span className="v-cascader-value" data-placeholder={hasValue ? undefined : ""}>
					{hasValue ? (
						<>
							<span aria-hidden={folded || undefined}>
								<PathText labels={labels} />
							</span>
							{folded ? <span className="v-cascader-sr">{fullText}</span> : null}
						</>
					) : (
						placeholder
					)}
				</span>
				{status16 ??
					(readOnly ? null : (
						<span className="v-input-control__trailing" aria-hidden="true">
							<ChevronDown />
						</span>
					))}
			</button>
		);
	}

	const model: PanelModel = {
		uid,
		options,
		loaded,
		status,
		canLoad,
		value,
		active: panel.active,
		expanded: panel.expanded,
		mode,
		empty,
		query,
		hits,
		searchIndex: clampedIndex,
		rowId,
		hitId,
		onRowClick,
		onRowEnter,
		onRowLeave,
		onHitClick: (hit) => {
			commit(hit.path);
			closeToTrigger();
		},
		onHitMove: (index) => {
			if (mode !== "pointer") setMode("pointer");
			setSearchIndex(index);
		},
	};

	const treeLabel = triggerRef.current?.getAttribute("aria-label") ?? undefined;
	const treeLabelledBy = treeLabel
		? undefined
		: (triggerRef.current?.getAttribute("aria-labelledby") ?? triggerRef.current?.id);
	const back = () =>
		setPanel((current) => ({
			active: current.expanded,
			expanded: current.expanded.slice(0, -1),
		}));
	const showPanel = open || panelPresent;

	return (
		<>
			{trigger}
			{showPanel ? (
				<PickerPanel
					open={open}
					onOpenChange={(next) => setOpen(next)}
					anchorRef={anchorRef}
					container={container}
					collisionBoundary={collisionBoundary}
					className={cn("v-cascader-content", contentClassName)}
					onPlaced={centerPath}
					onPresenceChange={setPanelPresent}
				>
					{drill && !searching && panel.expanded.length > 0 ? (
						<button
							type="button"
							tabIndex={-1}
							className="v-cascader-back"
							onClick={back}
						>
							<span aria-hidden="true">‹</span>
							<span>返回</span>
						</button>
					) : null}
					<div
						ref={treeRef}
						id={treeId}
						data-slot="cascader-tree"
						role="tree"
						aria-label={treeLabel}
						aria-labelledby={treeLabelledBy}
						data-drill={drill ? "" : undefined}
						onPointerMove={(event) => {
							pointerAt.current = { x: event.clientX, y: event.clientY };
							if (mode !== "pointer") setMode("pointer");
						}}
						className="v-cascader-tree"
					>
						{searching ? (
							<SearchResults model={model} />
						) : (
							visibleColumns.map((column, index) => (
								<ColumnView
									key={firstVisibleDepth + index}
									column={column}
									depth={firstVisibleDepth + index}
									model={model}
								/>
							))
						)}
					</div>
				</PickerPanel>
			) : null}
			{name
				? value.map((segment, index) => (
						<input
							key={`${index}:${segment}`}
							type="hidden"
							name={name}
							form={form}
							value={segment}
							disabled={disabled}
						/>
					))
				: null}
		</>
	);
}
