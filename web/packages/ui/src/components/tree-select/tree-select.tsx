"use client";

import { cn } from "cn";
import {
	Check,
	ChevronRight,
	ChevronsUpDown,
	File,
	Folder,
	FolderOpen,
	Search,
	X,
} from "lucide-react";
import { useControllableState } from "radix-ui/internal";
import {
	type ChangeEvent,
	type CSSProperties,
	type FocusEvent,
	type KeyboardEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { highlightMatch, PickerEmpty, PickerPanel } from "../../lib/picker-panel";
import {
	type ListboxItem,
	type ListboxItemProps,
	type ListboxMode,
	useListbox,
} from "../../lib/use-listbox";
import { iconProps } from "../icons";
import { Spinner } from "../indicator";
import { type InputVariantProps, inputVariants } from "../input/styles";
import { useListHighlight } from "../list-highlight/use-list-highlight";
import {
	ancestorsOf,
	buildTree,
	type CheckState,
	computeStates,
	coverNodes,
	removeNode,
	type TreeNode,
	type TreeSelectOption,
	toggleNode,
	type VisibleRow,
	visibleRows,
} from "./tree-model";

export type { TreeSelectOption } from "./tree-model";

type LoadStatus = "loading" | "failed";

const EMPTY_LIST: string[] = [];

interface TreeSelectBaseProps extends InputVariantProps {
	/** 选项树。`value` 在整棵树里必须唯一；懒加载取回的子节点同样不能重复。 */
	options: readonly TreeSelectOption[];
	/** 表单字段名；给了才渲染隐藏输入参与 FormData（多选每个值一个）。 */
	name?: string;
	/** 隐藏输入所属表单的 id，对应原生 `form` 属性。 */
	form?: string;
	disabled?: boolean;
	/** 只读：可聚焦、可读屏，但不能展开，也没有箭头。 */
	readOnly?: boolean;
	/** 写入 `aria-required`；隐藏输入不参与原生必填校验。 */
	required?: boolean;
	/** 触发器显示加载指示、`aria-busy`；没有选项时面板显示「加载中…」。 */
	loading?: boolean;
	/** 出错外观，并写入 `aria-invalid`；显式值优先于传入的 `aria-invalid`。 */
	invalid?: boolean;
	/** 通过外观（成功色），只是视觉反馈。 */
	valid?: boolean;
	/** 没有选择时的占位文字；可搜索时是搜索输入的占位。 */
	placeholder?: string;
	/** 触发器变成搜索输入：输入过滤树，只留匹配的节点与它们的祖先。 */
	searchable?: boolean;
	/** 懒加载：展开 `lazy` 节点时调用，返回它的子节点；抛错或拒绝表示失败，点该行重试。 */
	loadChildren?: (option: TreeSelectOption) => Promise<readonly TreeSelectOption[]>;
	/** 没有任何节点时面板里的文字，默认「无节点」。 */
	emptyText?: ReactNode;
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	/** 展开着的节点的 `value`。关闭再打开保持；打开时已选节点的祖先会被补进来。 */
	expanded?: string[];
	defaultExpanded?: string[];
	onExpandedChange?: (expanded: string[]) => void;
	/** 多选最多画几个芯片，其余折成「+N」。默认 2。 */
	maxChips?: number;
	/** 挂载面板的容器；默认 `document.body`。陈列室舞台与带缩放的宿主需要传入。 */
	container?: HTMLElement | null;
	/** 判断「放不下」的边界，默认视口；与 `container` 一起给陈列室舞台用。 */
	collisionBoundary?: Element | null;
	/** 面板的类名。 */
	panelClassName?: string;
	/** 外壳（触发器）的类名与样式。 */
	className?: string;
	style?: CSSProperties;
	/** 落在真正可聚焦的元素上（按钮或输入框），表单项的标签 `for` 才命中它。 */
	id?: string;
	"aria-label"?: string;
	"aria-labelledby"?: string;
	"aria-describedby"?: string;
	"aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling";
}

/** 单选：值是 `string`，空串表示没有选择；点行选中并收起。 */
export interface TreeSelectSingleProps extends TreeSelectBaseProps {
	multiple?: false;
	value?: string;
	defaultValue?: string;
	onValueChange?: (value: string) => void;
	/** 只有叶子能选：点到目录只展开或收起。 */
	leafOnly?: boolean;
}

/** 多选：值是被勾选的叶子 `value` 的数组；目录的勾选状态由它下面的叶子推出，选中后面板不收起。 */
export interface TreeSelectMultipleProps extends TreeSelectBaseProps {
	multiple: true;
	value?: string[];
	defaultValue?: string[];
	onValueChange?: (value: string[]) => void;
	leafOnly?: never;
}

export type TreeSelectProps = TreeSelectSingleProps | TreeSelectMultipleProps;

function isInvalid(invalid: boolean | undefined, ariaInvalid: TreeSelectProps["aria-invalid"]) {
	return (
		invalid ??
		(ariaInvalid === true ||
			ariaInvalid === "true" ||
			ariaInvalid === "grammar" ||
			ariaInvalid === "spelling")
	);
}

function pathOf(node: TreeNode) {
	return [...ancestorsOf(node).reverse(), node].map((item) => item.label).join(" / ");
}

interface TreeRowProps {
	id: string;
	row: VisibleRow;
	index: number;
	multiple: boolean;
	state: CheckState;
	selected: boolean;
	status: LoadStatus | undefined;
	searching: boolean;
	query: string;
	active: boolean;
	keyboardActive: boolean;
	onPointerMove: ListboxItemProps["onPointerMove"];
	register: (id: string, element: HTMLElement | null) => void;
	onActivate: (node: TreeNode, index: number) => void;
	onToggle: (node: TreeNode, index: number) => void;
}

function TreeRow({
	id,
	row,
	index,
	multiple,
	state,
	selected,
	status,
	searching,
	query,
	active,
	keyboardActive,
	onPointerMove,
	register,
	onActivate,
	onToggle,
}: TreeRowProps) {
	const [element, setElement] = useState<HTMLElement | null>(null);
	useLayoutEffect(() => {
		register(id, element);
		return () => register(id, null);
	}, [id, element, register]);

	// 展开状态记在节点上；正在取回的节点视作展开中，取回失败或换数据源后不再是目录就不报告展开
	const { node } = row;
	const failed = status === "failed";
	const busy = status === "loading";
	const open = row.open && (busy || node.kind === "branch");
	const isBranch = node.kind !== "leaf";
	const meta = failed ? "加载失败，点击重试" : node.option.meta;
	const icon = node.option.icon ?? (isBranch ? open ? <FolderOpen /> : <Folder /> : <File />);
	const highlighted = multiple ? state === "all" : selected;

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: 焦点始终在触发器上，键盘操作由触发器处理
		// biome-ignore lint/a11y/useFocusableInteractive: 焦点始终在触发器上，行用 aria-activedescendant 指向
		<div
			data-slot="tree-select-row"
			data-list-highlight-item=""
			id={id}
			role="treeitem"
			ref={setElement}
			aria-level={node.depth + 1}
			aria-posinset={node.position}
			aria-setsize={node.setSize}
			aria-expanded={isBranch ? open : undefined}
			aria-selected={multiple ? undefined : selected}
			aria-checked={multiple ? (state === "some" ? "mixed" : state === "all") : undefined}
			aria-disabled={node.disabled || undefined}
			aria-busy={busy || undefined}
			aria-labelledby={`${id}-label`}
			aria-describedby={meta ? `${id}-meta` : undefined}
			data-active={active ? "" : undefined}
			data-kb={keyboardActive ? "" : undefined}
			data-selected={highlighted ? "" : undefined}
			data-failed={failed ? "" : undefined}
			style={{ "--v-tree-depth": node.depth } as CSSProperties}
			className="v-tree-select__row"
			onPointerMove={onPointerMove}
			onClick={() => onActivate(node, index)}
		>
			{isBranch ? (
				<button
					type="button"
					tabIndex={-1}
					className="v-tree-select__chevron"
					aria-label="展开或收起"
					aria-disabled={searching || undefined}
					onClick={(event) => {
						event.stopPropagation();
						onToggle(node, index);
					}}
				>
					{busy ? (
						<Spinner size={16} aria-hidden="true" />
					) : (
						<ChevronRight {...iconProps(14)} aria-hidden="true" />
					)}
				</button>
			) : (
				<span className="v-tree-select__spacer" aria-hidden="true" />
			)}
			<span className="v-tree-select__body">
				{multiple ? (
					<span className="v-tree-select__box" data-state={state} aria-hidden="true">
						<Check />
						<span className="v-tree-select__dash" />
					</span>
				) : null}
				<span className="v-tree-select__icon" aria-hidden="true">
					{icon}
				</span>
				<span id={`${id}-label`} className="v-tree-select__label">
					{highlightMatch(node.label, searching ? query : "")}
				</span>
				{meta ? (
					<span id={`${id}-meta`} className="v-tree-select__meta">
						{meta}
					</span>
				) : null}
				{!multiple && selected ? (
					<Check className="v-tree-select__check" aria-hidden="true" />
				) : null}
			</span>
		</div>
	);
}

interface TreeListProps {
	id: string;
	mode: ListboxMode;
	multiselectable: boolean;
	label?: string;
	labelledBy?: string;
	hidden: boolean;
	children: ReactNode;
}

/** 面板里的滚动区与 `role="tree"`：与选择器族同一套滚动与悬停滑动高亮。 */
function TreeList({
	id,
	mode,
	multiselectable,
	label,
	labelledBy,
	hidden,
	children,
}: TreeListProps) {
	const highlight = useListHighlight<HTMLDivElement>();
	return (
		<div
			data-slot="tree-select-tree"
			id={id}
			ref={highlight.ref}
			role="tree"
			aria-multiselectable={multiselectable || undefined}
			aria-label={label}
			aria-labelledby={labelledBy}
			hidden={hidden}
			data-mode={mode}
			className="v-picker-list v-list-highlight"
		>
			{children}
		</div>
	);
}

/**
 * 在树里选一个或几个节点的选择器。`options` 是树，触发器复用输入框外壳。
 *
 * 焦点始终留在触发器（可搜索时是搜索输入），高亮行靠 `aria-activedescendant` 告知读屏。
 * 单选的值是被选节点的 `value`；多选的值是被勾选的**叶子**，勾选目录等于勾选它下面所有可选的叶子，
 * 目录的未选、部分选中、全部选中由叶子推出，触发器里的芯片只列「覆盖最少节点」。
 *
 * @example
 * ```tsx
 * <TreeSelect
 *   aria-label="素材目录"
 *   placeholder="选择目录"
 *   options={[{ value: "2026", label: "2026", children: [{ value: "spring", label: "春" }] }]}
 *   value={folder}
 *   onValueChange={setFolder}
 * />
 * ```
 */
export function TreeSelect(props: TreeSelectProps) {
	const {
		options,
		multiple = false,
		name,
		form,
		disabled = false,
		readOnly = false,
		required = false,
		loading = false,
		invalid,
		valid = false,
		variant,
		controlSize,
		placeholder,
		searchable = false,
		loadChildren,
		emptyText = "无节点",
		open: openProp,
		defaultOpen = false,
		onOpenChange,
		maxChips = 2,
		container,
		collisionBoundary,
		panelClassName,
		className,
		style,
		id,
		"aria-label": ariaLabel,
		"aria-labelledby": labelledByProp,
		"aria-describedby": describedBy,
		"aria-invalid": ariaInvalid,
	} = props;
	const leafOnly = props.multiple ? false : Boolean(props.leafOnly);

	const baseId = useId();
	const treeId = `${baseId}-tree`;
	const fieldId = id ?? `${baseId}-field`;
	const anchorRef = useRef<HTMLElement | null>(null);
	const fieldRef = useRef<HTMLElement | null>(null);

	const emptyValue = multiple ? EMPTY_LIST : "";
	const [raw = emptyValue, setRaw] = useControllableState<string | string[]>({
		prop: props.value,
		defaultProp: props.defaultValue ?? emptyValue,
		onChange: props.onValueChange as ((value: string | string[]) => void) | undefined,
	});
	const values = useMemo(() => (Array.isArray(raw) ? raw : raw ? [raw] : EMPTY_LIST), [raw]);
	const selectedSet = useMemo(() => new Set(values), [values]);

	const [expandedList = EMPTY_LIST, setExpanded] = useControllableState<string[]>({
		prop: props.expanded,
		defaultProp: props.defaultExpanded ?? EMPTY_LIST,
		onChange: props.onExpandedChange,
	});
	const expandedSet = useMemo(() => new Set(expandedList), [expandedList]);
	// 异步取回完成时要拿到最新的 setter：受控时 setter 带着当时的 prop
	const setExpandedRef = useRef(setExpanded);
	setExpandedRef.current = setExpanded;

	const [openState = false, setOpenState] = useControllableState({
		prop: openProp,
		defaultProp: defaultOpen,
		onChange: onOpenChange,
	});
	const open = openState && !disabled && !readOnly;

	const [query, setQuery] = useState("");
	const searching = searchable && query.trim() !== "";

	const [loaded, setLoaded] = useState<ReadonlyMap<string, readonly TreeSelectOption[]>>(
		() => new Map(),
	);
	const [status, setStatus] = useState<Readonly<Record<string, LoadStatus>>>({});
	// 取回的子节点缓存属于这份数据源：options 或 loadChildren 换了，旧缓存与在途请求的结果都作废
	const [cacheOwner, setCacheOwner] = useState({ options, loadChildren });
	if (cacheOwner.options !== options || cacheOwner.loadChildren !== loadChildren) {
		setCacheOwner({ options, loadChildren });
		setLoaded(new Map());
		setStatus({});
	}
	const inflight = useRef(new Set<string>());
	const generation = useRef(0);
	// biome-ignore lint/correctness/useExhaustiveDependencies: 数据源变化就是换了一代
	useEffect(() => {
		generation.current += 1;
		inflight.current.clear();
	}, [options, loadChildren]);
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
	const tree = useMemo(() => buildTree(options, loaded, canLoad), [options, loaded, canLoad]);
	const rows = useMemo(
		() => visibleRows(tree.roots, expandedSet, searching ? query : ""),
		[tree, expandedSet, searching, query],
	);
	const states = useMemo(
		() => (multiple ? computeStates(tree.roots, selectedSet) : null),
		[multiple, tree, selectedSet],
	);

	const ids = useRef(new Map<string, string>());
	const idCounter = useRef(0);
	const rowId = useCallback(
		(value: string) => {
			let found = ids.current.get(value);
			if (!found) {
				found = `${baseId}-r${idCounter.current++}`;
				ids.current.set(value, found);
			}
			return found;
		},
		[baseId],
	);

	const items = useMemo<ListboxItem[]>(
		() =>
			rows.map(({ node }) => ({
				id: rowId(node.value),
				// 禁用的目录仍可用键盘到达并展开，只是不能被选
				disabled: node.disabled && node.kind === "leaf",
			})),
		[rows, rowId],
	);
	const initialActiveId = useMemo(() => {
		const row = rows.find(({ node }) => selectedSet.has(node.value) && !node.disabled);
		return row ? rowId(row.node.value) : null;
	}, [rows, selectedSet, rowId]);
	const listbox = useListbox({ items, open, activateFirst: true, initialActiveId });

	const [panelPresent, setPanelPresent] = useState(false);
	const setOpen = useCallback(
		(next: boolean, mode: ListboxMode = "pointer") => {
			if (next && (disabled || readOnly)) return;
			listbox.setMode(mode);
			setOpenState(next);
		},
		[disabled, readOnly, listbox.setMode, setOpenState],
	);

	// 关闭时清掉搜索词
	useEffect(() => {
		if (!open) setQuery("");
	}, [open]);

	// 打开时把已选节点的祖先全部展开
	// biome-ignore lint/correctness/useExhaustiveDependencies: 只在打开的那一刻补一次
	useEffect(() => {
		if (!open) return;
		const missing: string[] = [];
		for (const value of values) {
			const node = tree.byValue.get(value);
			if (!node) continue;
			for (const ancestor of ancestorsOf(node)) {
				if (!expandedSet.has(ancestor.value) && !missing.includes(ancestor.value)) {
					missing.push(ancestor.value);
				}
			}
		}
		if (missing.length > 0) setExpanded((current) => [...current, ...missing]);
	}, [open]);

	// 搜索词变了，高亮回到第一个可用行
	// biome-ignore lint/correctness/useExhaustiveDependencies: 只由搜索词触发
	useEffect(() => {
		if (!open) return;
		listbox.setActiveIndex(
			items.findIndex((item) => !item.disabled),
			"keyboard",
		);
	}, [query]);

	const [placed, setPlaced] = useState(false);
	const centered = useRef(false);
	useEffect(() => {
		if (!open) {
			setPlaced(false);
			centered.current = false;
		}
	}, [open]);
	useEffect(() => {
		if (!open || !placed || centered.current || !listbox.activeId) return;
		centered.current = true;
		listbox.scrollActiveIntoView("center");
	}, [open, placed, listbox.activeId, listbox.scrollActiveIntoView]);

	const focusField = () => fieldRef.current?.focus({ preventScroll: true });
	const commit = (next: string[]) => {
		if (next === values) return;
		setRaw(multiple ? next : (next[0] ?? ""));
	};
	const editable = !disabled && !readOnly;

	const requestLoad = (node: TreeNode) => {
		const loader = loadRef.current;
		if (!loader || inflight.current.has(node.value)) return;
		inflight.current.add(node.value);
		const value = node.value;
		setStatus((current) => ({ ...current, [value]: "loading" }));
		setExpandedRef.current((current) =>
			current.includes(value) ? current : [...current, value],
		);
		const generationAtStart = generation.current;
		const finish = () => {
			if (generationAtStart !== generation.current) return false;
			inflight.current.delete(value);
			return alive.current;
		};
		let pending: Promise<readonly TreeSelectOption[]>;
		try {
			pending = Promise.resolve(loader(node.option));
		} catch (error) {
			pending = Promise.reject(error);
		}
		pending.then(
			(children) => {
				if (!finish()) return;
				setLoaded((current) => new Map(current).set(value, children));
				setStatus(({ [value]: _done, ...rest }) => rest);
			},
			() => {
				if (!finish()) return;
				setStatus((current) => ({ ...current, [value]: "failed" }));
				setExpandedRef.current((current) => current.filter((item) => item !== value));
			},
		);
	};

	const toggleExpand = (node: TreeNode) => {
		if (searching) return;
		if (node.kind === "lazy") {
			requestLoad(node);
			return;
		}
		if (node.kind !== "branch") return;
		setExpanded((current) =>
			current.includes(node.value)
				? current.filter((item) => item !== node.value)
				: [...current, node.value],
		);
	};

	const activate = (node: TreeNode) => {
		if (!editable) return;
		if (node.kind === "lazy" && status[node.value] === "failed") {
			requestLoad(node);
			return;
		}
		if (multiple) {
			if (node.kind === "lazy") toggleExpand(node);
			else commit(toggleNode(node, values));
			return;
		}
		if (node.kind !== "leaf" && leafOnly) {
			toggleExpand(node);
			return;
		}
		if (node.disabled) return;
		commit([node.value]);
		setOpenState(false);
		focusField();
	};

	// 树里找不到的值（还没取回的节点等）也列成芯片，免得选了却看不见
	const chips =
		multiple && states
			? [
					...coverNodes(tree.roots, states).map((node) => ({
						key: node.value,
						label: node.label,
						remove: () => commit(removeNode(node, values)),
					})),
					...values
						.filter((value) => tree.byValue.get(value)?.kind !== "leaf")
						.map((value) => ({
							key: value,
							label: tree.byValue.get(value)?.label ?? value,
							remove: () => commit(values.filter((item) => item !== value)),
						})),
				]
			: [];

	// combobox 角色不从内容取名：没有 aria-label、aria-labelledby 与 id（也就没有 label for）时，
	// 用占位文案兜底，避免控件没有名称
	const named = ariaLabel !== undefined || labelledByProp !== undefined || id !== undefined;
	const placeholderId = `${baseId}-placeholder`;
	const summaryId = `${baseId}-summary`;
	const summary =
		chips.length === 0
			? null
			: chips.length <= 2
				? `已选 ${chips.map((chip) => chip.label).join("、")}`
				: `已选 ${chips
						.slice(0, 2)
						.map((chip) => chip.label)
						.join("、")} 等 ${chips.length} 项`;

	const singleNode = !multiple && values[0] ? tree.byValue.get(values[0]) : undefined;
	const singleLabel = !multiple && values[0] ? (singleNode?.label ?? values[0]) : "";
	const singlePath = singleNode ? pathOf(singleNode) : singleLabel;

	// 表单复位：不论受控与否都回到 defaultValue（没给则回到空），受控时由 onValueChange 通知调用方；
	// 事件被取消时不复位。监听的表单不依赖隐藏输入是否存在（多选清空后隐藏输入全部卸载）。
	const resetRef = useRef<() => void>(() => {});
	resetRef.current = () => setRaw(props.defaultValue ?? emptyValue);
	useEffect(() => {
		const byId = form ? document.getElementById(form) : null;
		const owner =
			byId instanceof HTMLFormElement ? byId : (fieldRef.current?.closest("form") ?? null);
		if (!owner) return;
		const onReset = (event: Event) => {
			setTimeout(() => {
				if (!event.defaultPrevented) resetRef.current();
			}, 0);
		};
		owner.addEventListener("reset", onReset);
		return () => owner.removeEventListener("reset", onReset);
	}, [form]);

	const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
		if (event.defaultPrevented || !editable || event.nativeEvent.isComposing) return;
		if (event.altKey || event.ctrlKey || event.metaKey) return;
		if (!open) {
			const opens = searchable
				? ["ArrowDown", "ArrowUp"]
				: ["Enter", " ", "ArrowDown", "ArrowUp"];
			if (opens.includes(event.key)) {
				event.preventDefault();
				setOpen(true, "keyboard");
			}
			return;
		}
		const index = listbox.activeIndex;
		const current = index >= 0 ? rows[index] : undefined;
		// 搜索输入里：Home / End 与有搜索词时的左右键留给光标
		const caretKey =
			searchable &&
			(event.key === "Home" ||
				event.key === "End" ||
				((event.key === "ArrowLeft" || event.key === "ArrowRight") && query !== ""));
		if (caretKey) return;
		switch (event.key) {
			case "ArrowRight": {
				if (!current || current.node.kind === "leaf" || searching) return;
				event.preventDefault();
				if (current.node.kind === "lazy") requestLoad(current.node);
				else if (!current.open) toggleExpand(current.node);
				else listbox.setActiveIndex(index + 1);
				return;
			}
			case "ArrowLeft": {
				if (!current || searching) return;
				event.preventDefault();
				if (current.node.kind === "branch" && current.open) {
					toggleExpand(current.node);
				} else if (current.node.parent) {
					const parent = current.node.parent;
					listbox.setActiveIndex(rows.findIndex((row) => row.node === parent));
				}
				return;
			}
			case "Enter":
				event.preventDefault();
				if (current) activate(current.node);
				return;
			case " ":
				if (searchable) return;
				event.preventDefault();
				if (current) activate(current.node);
				return;
			case "Escape":
				event.preventDefault();
				setOpen(false);
				focusField();
				return;
			case "Tab":
				// 去下一个控件：关闭但不还焦点
				setOpen(false);
				return;
		}
		if (listbox.handleKeyDown(event)) event.preventDefault();
	};

	const closeOnBlurOutside = (event: FocusEvent<HTMLElement>) => {
		if (!open) return;
		const next = event.relatedTarget;
		if (next instanceof Node) {
			if (anchorRef.current?.contains(next)) return;
			if (next instanceof Element && next.closest("[data-slot=picker-panel]")) return;
		}
		setOpen(false);
	};

	const toggle = () => {
		if (!editable) return;
		// Safari 点按钮不聚焦，键盘操作需要焦点在触发器上
		focusField();
		setOpen(!open, "pointer");
	};
	const openOnly = () => {
		if (!editable) return;
		focusField();
		if (!open) setOpen(true, "pointer");
	};
	/** 关闭态的输入框里显示的是已选路径，在它后面打字只算新打的那几个字。 */
	const onSearchInput = (event: ChangeEvent<HTMLInputElement>, shown: string) => {
		const typed = event.target.value;
		setQuery(!open && typed.startsWith(shown) ? typed.slice(shown.length) : typed);
		if (!open) setOpen(true, "keyboard");
	};

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
		id: fieldId,
		role: "combobox" as const,
		"aria-label": ariaLabel,
		"aria-labelledby": labelledByProp,
		"aria-describedby":
			[describedBy, multiple && summary ? summaryId : undefined].filter(Boolean).join(" ") ||
			undefined,
		"aria-haspopup": "tree" as const,
		"aria-controls": treeId,
		"aria-expanded": open,
		"aria-activedescendant": open ? listbox.activeId : undefined,
		"aria-invalid": invalid === undefined ? ariaInvalid : invalid,
		"aria-required": required || undefined,
		"aria-readonly": readOnly || undefined,
		"aria-busy": loading || undefined,
		disabled,
		onKeyDown: handleKeyDown,
	};

	const shellClass = (extra: string) =>
		inputVariants({ variant, controlSize, className: cn(extra, className) });

	const trailing = loading ? (
		<span className="v-input-control__status" data-status="loading">
			<Spinner size={16} aria-hidden="true" />
		</span>
	) : readOnly ? null : (
		<span className="v-input-control__trailing" aria-hidden="true">
			<ChevronsUpDown />
		</span>
	);

	const setAnchor = useCallback((node: HTMLElement | null) => {
		anchorRef.current = node;
	}, []);
	const setField = useCallback((node: HTMLElement | null) => {
		fieldRef.current = node;
	}, []);
	const setBoth = useCallback((node: HTMLElement | null) => {
		anchorRef.current = node;
		fieldRef.current = node;
	}, []);

	const clearAll = () => {
		if (!editable) return;
		// 清除钮随即卸载，先把焦点还给触发器
		focusField();
		commit([]);
		setQuery("");
	};
	const hasClear = editable && (values.length > 0 || query !== "");

	let trigger: ReactNode;
	if (multiple) {
		const shown = chips.slice(0, maxChips);
		const hidden = chips.length - shown.length;
		trigger = (
			// biome-ignore lint/a11y/useKeyWithClickEvents: 外壳空白处的点击只是聚焦控件的放大热区，键盘走里面的控件
			<div
				data-slot="tree-select-trigger"
				{...stateAttrs}
				ref={setAnchor}
				style={style}
				className={shellClass("v-tree-select__shell v-tree-select__shell--multiple")}
				onMouseDown={(event) => {
					if (event.button !== 0 || (event.target as Element).closest("button, input"))
						return;
					event.preventDefault();
				}}
				onClick={(event) => {
					if ((event.target as Element).closest("button")) return;
					if (searchable) openOnly();
					else toggle();
				}}
				onBlur={closeOnBlurOutside}
			>
				{shown.map((chip) => (
					<span key={chip.key} className="v-tree-select__chip">
						<span className="v-tree-select__chip-label">{chip.label}</span>
						{editable ? (
							<button
								type="button"
								tabIndex={-1}
								className="v-tree-select__chip-remove"
								aria-label={`移除 ${chip.label}`}
								onMouseDown={(event) => event.preventDefault()}
								onClick={chip.remove}
							>
								<X {...iconProps(12)} aria-hidden="true" />
							</button>
						) : null}
					</span>
				))}
				{hidden > 0 ? (
					<span className="v-tree-select__chip v-tree-select__chip--more">+{hidden}</span>
				) : null}
				{searchable ? (
					<input
						data-slot="tree-select-input"
						{...shared}
						aria-label={ariaLabel ?? (named ? undefined : placeholder)}
						ref={setField}
						type="text"
						autoComplete="off"
						aria-autocomplete="list"
						readOnly={readOnly}
						value={query}
						placeholder={chips.length === 0 ? placeholder : undefined}
						className="v-input v-tree-select__input"
						onChange={(event) => onSearchInput(event, query)}
					/>
				) : (
					<button
						data-slot="tree-select-toggle"
						{...shared}
						aria-labelledby={labelledByProp ?? (named ? undefined : placeholderId)}
						ref={setField}
						type="button"
						className="v-tree-select__toggle"
						onClick={toggle}
					>
						{placeholder && chips.length === 0 ? (
							<span
								id={placeholderId}
								className="v-tree-select__value"
								data-placeholder=""
							>
								{placeholder}
							</span>
						) : null}
					</button>
				)}
				{summary ? (
					<span id={summaryId} className="v-tree-select__sr">
						{summary}
					</span>
				) : null}
				{hasClear ? (
					<button
						type="button"
						className="v-input-control__action v-input-control__action--clear"
						aria-label="清除全部"
						onMouseDown={(event) => event.preventDefault()}
						onClick={clearAll}
					>
						<X {...iconProps(14)} aria-hidden="true" />
					</button>
				) : null}
				{trailing}
			</div>
		);
	} else if (searchable) {
		trigger = (
			// biome-ignore lint/a11y/useKeyWithClickEvents: 外壳空白处的点击只是聚焦输入框的放大热区
			<div
				data-slot="tree-select-trigger"
				{...stateAttrs}
				ref={setAnchor}
				style={style}
				className={shellClass("v-tree-select__shell")}
				onMouseDown={(event) => {
					if (event.button !== 0 || (event.target as Element).closest("button, input"))
						return;
					event.preventDefault();
					focusField();
				}}
				onClick={(event) => {
					if ((event.target as Element).closest("button")) return;
					openOnly();
				}}
				onBlur={closeOnBlurOutside}
			>
				<span className="v-input-control__leading" aria-hidden="true">
					<Search />
				</span>
				<input
					data-slot="tree-select-input"
					{...shared}
					aria-label={ariaLabel ?? (named ? undefined : placeholder)}
					ref={setField}
					type="text"
					autoComplete="off"
					aria-autocomplete="list"
					readOnly={readOnly}
					value={open ? query : singlePath}
					placeholder={placeholder}
					className="v-input v-tree-select__input"
					onChange={(event) => onSearchInput(event, open ? query : singlePath)}
				/>
				{hasClear ? (
					<button
						type="button"
						className="v-input-control__action v-input-control__action--clear"
						aria-label="清除"
						onMouseDown={(event) => event.preventDefault()}
						onClick={clearAll}
					>
						<X {...iconProps(14)} aria-hidden="true" />
					</button>
				) : null}
				{loading ? trailing : null}
			</div>
		);
	} else {
		trigger = (
			<button
				data-slot="tree-select-trigger"
				{...shared}
				aria-labelledby={labelledByProp ?? (named ? undefined : `${baseId}-value`)}
				{...stateAttrs}
				ref={setBoth}
				type="button"
				style={style}
				className={shellClass("v-tree-select__trigger")}
				onClick={toggle}
				onBlur={closeOnBlurOutside}
			>
				<span
					id={`${baseId}-value`}
					className="v-tree-select__value"
					data-placeholder={singleLabel ? undefined : ""}
					title={singleNode && singleNode.depth > 0 ? singlePath : undefined}
				>
					{singleLabel || placeholder}
				</span>
				{trailing}
			</button>
		);
	}

	const showPanel = open || panelPresent;
	const hasRows = rows.length > 0;
	const mode = listbox.mode;
	const onToggle = (node: TreeNode, index: number) => {
		if (!editable) return;
		listbox.setActiveIndex(index, "pointer");
		toggleExpand(node);
	};
	const onActivate = (node: TreeNode, index: number) => {
		if (!editable) return;
		listbox.setActiveIndex(index, "pointer");
		activate(node);
	};

	return (
		<>
			{trigger}
			{!multiple ? (
				<span className="v-tree-select__sr" role="status">
					{singlePath}
				</span>
			) : null}
			{showPanel ? (
				<PickerPanel
					open={open}
					onOpenChange={(next) => setOpen(next)}
					anchorRef={anchorRef}
					container={container}
					collisionBoundary={collisionBoundary}
					className={cn("v-tree-select__panel", panelClassName)}
					onPlaced={() => setPlaced(true)}
					onPresenceChange={setPanelPresent}
				>
					<TreeList
						id={treeId}
						mode={mode}
						multiselectable={multiple}
						label={ariaLabel}
						labelledBy={ariaLabel ? undefined : (labelledByProp ?? fieldId)}
						hidden={!hasRows}
					>
						{rows.map((row, index) => {
							const value = row.node.value;
							const itemProps = listbox.getItemProps(index);
							return (
								<TreeRow
									key={value}
									id={rowId(value)}
									row={row}
									index={index}
									multiple={multiple}
									state={states?.get(value) ?? "none"}
									selected={selectedSet.has(value)}
									status={status[value]}
									searching={searching}
									query={query}
									active={itemProps["data-active"] !== undefined}
									keyboardActive={itemProps["data-kb"] !== undefined}
									onPointerMove={itemProps.onPointerMove}
									register={listbox.registerItem}
									onActivate={onActivate}
									onToggle={onToggle}
								/>
							);
						})}
					</TreeList>
					{hasRows ? null : loading && options.length === 0 ? (
						<PickerEmpty role="status">
							<Spinner size={16} aria-hidden="true" />
							加载中…
						</PickerEmpty>
					) : (
						<PickerEmpty>{searching ? "无匹配节点" : emptyText}</PickerEmpty>
					)}
				</PickerPanel>
			) : null}
			{name
				? values.length > 0
					? values.map((value) => (
							<input
								key={value}
								type="hidden"
								name={name}
								form={form}
								value={value}
								disabled={disabled}
							/>
						))
					: // 单选没有选择时仍提交空串，与原生 select 一致；多选没有选择就不提交
						!multiple && (
							<input
								type="hidden"
								name={name}
								form={form}
								value=""
								disabled={disabled}
							/>
						)
				: null}
		</>
	);
}
