"use client";

import { cn } from "cn";
import { Plus, X } from "lucide-react";
import { useComposedRefs, useControllableState } from "radix-ui/internal";
import {
	type ChangeEvent,
	type ComponentProps,
	type FocusEvent,
	type KeyboardEvent,
	type MouseEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	highlightMatch,
	PickerEmpty,
	PickerGroup,
	PickerLabel,
	PickerList,
	PickerOption,
	PickerPanel,
} from "../../lib/picker-panel";
import { type ListboxItem, type UseListboxResult, useListbox } from "../../lib/use-listbox";
import { Spinner } from "../indicator";
import { type InputVariantProps, inputVariants } from "../input/styles";

/** 停手多久后触发 `onSearch`。 */
const SEARCH_DELAY_MS = 300;

/** 一条建议。`value` 在同一个组合框里必须唯一。 */
export interface ComboboxOption {
	value: string;
	/** 输入框里显示的文字，也是内置过滤与匹配高亮的对象。 */
	label: string;
	/** 第二行说明，使这一行变成两行。 */
	description?: ReactNode;
	/** 32px 图标块。 */
	icon?: ReactNode;
	/** 行内右侧的附加信息，如栏目与日期。 */
	meta?: ReactNode;
	disabled?: boolean;
	/** 分组名；连续的同名选项归入一个 `role="group"`，组名 12px 次级文字，不画分割线。 */
	group?: string;
}

/** `onSearch` 的第二个参数。 */
export interface ComboboxSearchContext {
	/** 这一轮查询过期（被新一轮取代、失焦、选中、清除、卸载）时中止。 */
	signal: AbortSignal;
}

/** 内置过滤：返回 `true` 的选项才出现在建议里。`query` 已去掉首尾空白。 */
export type ComboboxFilter = (option: ComboboxOption, query: string) => boolean;

/**
 * 输入框文字变化的来源：
 * `input` 用户键入；`select` 选中建议或创建、外部值变化；`clear` 清除钮或第二次 Esc；`revert` 失焦时还原。
 */
export type ComboboxInputReason = "input" | "select" | "clear" | "revert";

const defaultFilter: ComboboxFilter = (option, query) =>
	option.label.toLowerCase().includes(query.toLowerCase());

/**
 * 原生 input 属性透传给输入框，除了：`className`、`style` 属于外壳；`name`、`form` 属于隐藏输入；
 * `value`、`defaultValue`、`onChange` 由组合框接管，改用 `value` 与 `inputValue` 两组。
 */
export interface ComboboxProps
	extends Omit<
			ComponentProps<"input">,
			| "value"
			| "defaultValue"
			| "onChange"
			| "type"
			| "role"
			| "size"
			| "list"
			| "children"
			| "checked"
			| "defaultChecked"
		>,
		InputVariantProps {
	/** 建议集合。有 `onSearch` 时是服务端返回的当前结果。 */
	options: readonly ComboboxOption[];
	/** 已选建议的 `value`，空串表示没有选择。 */
	value?: string;
	defaultValue?: string;
	onValueChange?: (value: string) => void;
	/** 输入框里的文字；失焦未选中时会还原为已选建议的 `label`。 */
	inputValue?: string;
	defaultInputValue?: string;
	onInputChange?: (text: string, reason: ComboboxInputReason) => void;
	/**
	 * 停手 300ms 后调用，参数是输入框里的文字；异步结果通过 `options` 与 `loading` 回写。
	 * `signal` 在下一轮查询开始、失焦、选中、清除与卸载时中止：请求用 `fetch(…, { signal })`，
	 * 或回写前判断 `signal.aborted`，晚到的旧结果就不会覆盖新结果。
	 */
	onSearch?: (query: string, context: ComboboxSearchContext) => void;
	/** 正在请求：右侧出现指示器并设 `aria-busy`，列表保留旧结果；没有结果时面板写「正在查找…」。 */
	loading?: boolean;
	/**
	 * 是否由组合框按输入过滤 `options`：`true` 大小写不敏感的包含匹配，函数自定义，`false` 全部列出。
	 * 缺省：有 `onSearch` 时为 `false`（结果已由服务端筛过），否则为 `true`。
	 */
	filter?: boolean | ComboboxFilter;
	/** 最多列出几条建议，默认 8；创建项不计入。 */
	maxSuggestions?: number;
	/** 给建议里第一处命中的文字加底色，默认开。 */
	highlight?: boolean;
	/** 没有完全相同的建议时，末行出现「创建「xxx」」，Enter 也可直接采用键入的文字。 */
	creatable?: boolean;
	/** 采用键入的文字时调用，随后 `onValueChange` 收到同一个文字。 */
	onCreate?: (text: string) => void;
	/** 没有建议时的内容；缺省有 `onSearch` 写「没有找到「xxx」」，否则「没有匹配的项」。 */
	emptyText?: ReactNode | ((query: string) => ReactNode);
	/** 有文字时显示清除钮，默认开；清除同时清空已选值。 */
	clearable?: boolean;
	/** 输入框前的 16px 图标。 */
	leading?: ReactNode;
	/** 表单字段名；给了才渲染隐藏输入，提交的是已选值（或创建的文字），不是输入框里的草稿。 */
	name?: string;
	form?: string;
	/** 出错外观，并写入 `aria-invalid`；显式值优先于传入的 `aria-invalid`。 */
	invalid?: boolean;
	/** 通过外观（成功色），只是视觉反馈。 */
	valid?: boolean;
	/** 写入 `aria-required`；隐藏输入不参与原生必填校验。 */
	required?: boolean;
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	/** 挂载面板的容器；默认 `document.body`。陈列室舞台与带缩放的宿主需要传入。 */
	container?: HTMLElement | null;
	/** 判断「放不下」的边界，默认视口。 */
	collisionBoundary?: Element | null;
	/** 面板的 className。 */
	panelClassName?: string;
}

interface Entry {
	/** 选项行的 DOM id，也是引擎里的 id。 */
	id: string;
	option?: ComboboxOption;
	/** 创建项要采用的文字。 */
	create?: string;
}

interface PanelView {
	entries: Entry[];
	/** 去掉首尾空白的查询，匹配高亮用。 */
	needle: string;
	mode: "list" | "busy" | "empty" | "none";
	empty: ReactNode;
}

interface Segment {
	group: string | undefined;
	rows: { entry: Entry; index: number }[];
}

function toSegments(entries: readonly Entry[]): Segment[] {
	const segments: Segment[] = [];
	entries.forEach((entry, index) => {
		const group = entry.option?.group;
		const last = segments.at(-1);
		if (last && last.group === group) last.rows.push({ entry, index });
		else segments.push({ group, rows: [{ entry, index }] });
	});
	return segments;
}

function isInvalid(invalid: boolean | undefined, ariaInvalid: ComboboxProps["aria-invalid"]) {
	return (
		invalid ??
		(ariaInvalid === true ||
			ariaInvalid === "true" ||
			ariaInvalid === "grammar" ||
			ariaInvalid === "spelling")
	);
}

interface RowProps {
	entry: Entry;
	index: number;
	listbox: UseListboxResult;
	selected: boolean;
	needle: string;
	highlight: boolean;
	onChoose: (entry: Entry) => void;
}

function ComboboxRow({ entry, index, listbox, selected, needle, highlight, onChoose }: RowProps) {
	const { registerItem } = listbox;
	const [element, setElement] = useState<HTMLElement | null>(null);
	useLayoutEffect(() => {
		registerItem(entry.id, element);
		return () => registerItem(entry.id, null);
	}, [entry.id, element, registerItem]);

	const { option } = entry;
	const itemProps = listbox.getItemProps(index);
	if (!option) {
		return (
			<PickerOption
				data-slot="combobox-option"
				data-create=""
				{...itemProps}
				ref={setElement}
				onClick={() => onChoose(entry)}
			>
				<Plus className="v-combobox__create-icon" aria-hidden="true" />
				创建「{entry.create}」
			</PickerOption>
		);
	}
	return (
		<PickerOption
			data-slot="combobox-option"
			{...itemProps}
			ref={setElement}
			selected={selected}
			indicator="check"
			icon={option.icon}
			description={option.description}
			meta={option.meta}
			onClick={() => {
				if (!option.disabled) onChoose(entry);
			}}
		>
			{highlight ? highlightMatch(option.label, needle) : option.label}
		</PickerOption>
	);
}

/**
 * 能打字的输入框加一列建议：可以从建议里选，开启 `creatable` 也可以就用自己打的字。
 * 外壳是输入框外壳，浮层与选择器相同；选项只能选、不能打字用 select，要输入多个值用 tag-input。
 *
 * 焦点始终在输入框，高亮的建议用 `aria-activedescendant` 告知读屏。
 *
 * @example
 * ```tsx
 * <Combobox
 *   aria-label="标签"
 *   options={TAGS.map((tag) => ({ value: tag, label: tag }))}
 *   value={tag}
 *   onValueChange={setTag}
 *   creatable
 * />
 * ```
 */
export function Combobox({
	ref,
	className,
	style,
	variant,
	controlSize,
	options,
	value: valueProp,
	defaultValue,
	onValueChange,
	inputValue: inputProp,
	defaultInputValue,
	onInputChange,
	onSearch,
	loading = false,
	filter,
	maxSuggestions = 8,
	highlight = true,
	creatable = false,
	onCreate,
	emptyText,
	clearable = true,
	leading,
	name,
	form,
	invalid,
	valid = false,
	required = false,
	disabled = false,
	readOnly = false,
	open: openProp,
	defaultOpen = false,
	onOpenChange,
	container,
	collisionBoundary,
	panelClassName,
	id: idProp,
	"aria-invalid": ariaInvalidProp,
	"aria-labelledby": labelledByProp,
	"aria-label": ariaLabel,
	onFocus,
	onBlur,
	onClick,
	onKeyDown,
	...props
}: ComboboxProps) {
	const baseId = useId();
	const id = idProp ?? baseId;
	const listboxId = `${baseId}-list`;
	const inputRef = useRef<HTMLInputElement | null>(null);
	const shellRef = useRef<HTMLDivElement | null>(null);
	const composedRef = useComposedRefs(ref, inputRef);

	// 选项 id 以 value 为键，筛选与重排后高亮仍跟着同一条建议走
	const ids = useRef(new Map<string, number>());
	const idOf = useCallback(
		(optionValue: string) => {
			let serial = ids.current.get(optionValue);
			if (serial === undefined) {
				serial = ids.current.size;
				ids.current.set(optionValue, serial);
			}
			return `${baseId}-o${serial}`;
		},
		[baseId],
	);
	// 已选值的文字：当前选项里找不到（异步结果换了一批、创建的文字）时用最近一次见到的标签
	const labels = useRef(new Map<string, string>());
	for (const option of options) labels.current.set(option.value, option.label);
	const labelOf = (optionValue: string) =>
		optionValue ? (labels.current.get(optionValue) ?? optionValue) : "";

	const [value = "", setValue] = useControllableState<string>({
		prop: valueProp,
		defaultProp: defaultValue ?? "",
		onChange: onValueChange,
	});
	const selectedLabel = labelOf(value);

	const [inputState, setInputState] = useState(
		() => inputProp ?? defaultInputValue ?? labelOf(valueProp ?? defaultValue ?? ""),
	);
	const inputText = inputProp ?? inputState;
	const latestText = useRef(inputText);
	latestText.current = inputText;
	const setInputText = (text: string, reason: ComboboxInputReason) => {
		if (text === latestText.current) return;
		latestText.current = text;
		if (inputProp === undefined) setInputState(text);
		onInputChange?.(text, reason);
	};

	// 键入过之后，输入框里的文字就是查询；没键入时它只是已选值的标签，列表应当列全
	const [typed, setTyped] = useState(false);
	const query = !typed && inputText === selectedLabel ? "" : inputText;
	const needle = query.trim();

	const [openState = false, setOpenState] = useControllableState({
		prop: openProp,
		defaultProp: defaultOpen,
		onChange: onOpenChange,
	});
	const editable = !disabled && !readOnly;
	const open = openState && editable;

	const [pending, setPending] = useState(false);
	const searchTimer = useRef(0);
	const onSearchRef = useRef(onSearch);
	onSearchRef.current = onSearch;
	// 每一轮查询一个 AbortSignal：更新一轮查询、失焦、选中、清除、卸载都会中止上一轮
	const controller = useRef<AbortController | null>(null);
	const runSearch = (text: string) => {
		controller.current?.abort();
		controller.current = new AbortController();
		onSearchRef.current?.(text, { signal: controller.current.signal });
	};
	useEffect(
		() => () => {
			window.clearTimeout(searchTimer.current);
			controller.current?.abort();
		},
		[],
	);
	const cancelSearch = () => {
		window.clearTimeout(searchTimer.current);
		controller.current?.abort();
		setPending(false);
	};
	const scheduleSearch = (text: string) => {
		if (!onSearchRef.current) return;
		window.clearTimeout(searchTimer.current);
		controller.current?.abort();
		setPending(text.trim() !== "");
		searchTimer.current = window.setTimeout(() => {
			setPending(false);
			runSearch(text);
		}, SEARCH_DELAY_MS);
	};
	const busy = loading || pending;

	const filterMode = filter ?? !onSearch;
	const predicate = typeof filterMode === "function" ? filterMode : defaultFilter;
	const entries = useMemo<Entry[]>(() => {
		const matched =
			filterMode && needle ? options.filter((o) => predicate(o, needle)) : options;
		const list: Entry[] = matched
			.slice(0, maxSuggestions)
			.map((option) => ({ id: idOf(option.value), option }));
		const lower = needle.toLowerCase();
		if (creatable && needle && !options.some((o) => o.label.toLowerCase() === lower)) {
			list.push({ id: `${baseId}-create`, create: needle });
		}
		return list;
	}, [options, needle, filterMode, predicate, maxSuggestions, creatable, baseId, idOf]);

	const emptyNode =
		typeof emptyText === "function"
			? emptyText(needle)
			: (emptyText ?? (onSearch ? `没有找到「${needle}」` : "没有匹配的项"));
	const current: PanelView = {
		entries,
		needle,
		mode:
			entries.length > 0
				? "list"
				: busy && (needle !== "" || loading)
					? "busy"
					: needle
						? "empty"
						: "none",
		empty: emptyNode,
	};
	const hasPanel = current.mode !== "none";
	const panelOpen = open && hasPanel;
	// 收起动画播完前面板还挂着，内容停在收起那一刻，不随选中后的输入框文字变成全部建议
	const lastView = useRef<PanelView | null>(null);
	if (panelOpen) lastView.current = current;
	const view = panelOpen ? current : (lastView.current ?? current);

	const items = useMemo<ListboxItem[]>(
		() =>
			view.entries.map((entry) => ({
				id: entry.id,
				disabled: entry.option?.disabled,
				textValue: entry.option?.label,
			})),
		[view.entries],
	);
	const selectedId = value
		? view.entries.find((entry) => entry.option?.value === value)?.id
		: undefined;
	const listbox = useListbox({
		items,
		open: panelOpen,
		activateFirst: view.needle !== "",
		initialActiveId: view.needle === "" ? (selectedId ?? null) : null,
		selectedFor: "active",
	});

	// 键入后高亮回到第一条；结果晚到、高亮项被筛掉时同样补上
	const retarget = useRef(false);
	const openIntent = useRef<"first" | "last" | null>(null);
	const enabled = items.flatMap((item, index) => (item.disabled ? [] : [index]));
	const first = enabled[0] ?? -1;
	const last = enabled.at(-1) ?? -1;
	// biome-ignore lint/correctness/useExhaustiveDependencies: 只在展开、选项集合或文字变化时检查
	useLayoutEffect(() => {
		if (!panelOpen) return;
		const intent = openIntent.current;
		openIntent.current = null;
		if (intent) {
			const target = intent === "first" ? first : last;
			if (listbox.activeIndex < 0 && target >= 0) listbox.setActiveIndex(target, "keyboard");
			return;
		}
		if (view.needle === "") return;
		const reset = retarget.current;
		retarget.current = false;
		if ((reset || listbox.activeIndex < 0) && first >= 0 && listbox.activeIndex !== first) {
			listbox.setActiveIndex(first, "keyboard");
		}
	}, [panelOpen, items, inputText]);

	// 展开后第一次有高亮项且面板已定位时，把它滚到列表中间
	const [placed, setPlaced] = useState(false);
	const centered = useRef(false);
	useEffect(() => {
		if (!panelOpen) {
			setPlaced(false);
			centered.current = false;
		}
	}, [panelOpen]);
	useEffect(() => {
		if (!panelOpen || !placed || centered.current || !listbox.activeId) return;
		centered.current = true;
		listbox.scrollActiveIntoView("center");
	}, [panelOpen, placed, listbox.activeId, listbox.scrollActiveIntoView]);

	const setOpen = (next: boolean) => {
		if (next && !editable) return;
		setOpenState(next);
	};

	const choose = (entry: Entry) => {
		if (!editable) return;
		if (entry.option) {
			if (entry.option.disabled) return;
			labels.current.set(entry.option.value, entry.option.label);
			setValue(entry.option.value);
			setInputText(entry.option.label, "select");
		} else if (entry.create !== undefined) {
			labels.current.set(entry.create, entry.create);
			onCreate?.(entry.create);
			setValue(entry.create);
			setInputText(entry.create, "select");
		}
		cancelSearch();
		setTyped(false);
		setOpen(false);
	};
	// Enter 在没有高亮项时采用键入的文字：与某条建议完全相同就选它，否则创建
	const commitTyped = (text: string) => {
		const lower = text.toLowerCase();
		const exact = options.find((o) => !o.disabled && o.label.toLowerCase() === lower);
		choose(
			exact
				? { id: idOf(exact.value), option: exact }
				: { id: `${baseId}-create`, create: text },
		);
	};
	const clear = (reopen = true) => {
		if (!editable) return;
		cancelSearch();
		setValue("");
		setInputText("", "clear");
		setTyped(false);
		runSearch("");
		inputRef.current?.focus({ preventScroll: true });
		if (reopen) setOpen(true);
	};

	// 失焦：输入框里的文字与已选值保持一致，没选中的草稿还原为已选标签或清空
	const settle = () => {
		cancelSearch();
		setTyped(false);
		setInputText(selectedLabel, "revert");
	};

	const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
		const text = event.target.value;
		setTyped(true);
		setInputText(text, "input");
		if (text === "" && value !== "") setValue("");
		retarget.current = true;
		listbox.setMode("keyboard");
		setOpen(true);
		scheduleSearch(text);
	};

	const panelOpenRef = useRef(panelOpen);
	panelOpenRef.current = panelOpen;
	const lastEscape = useRef<{ event: Event; open: boolean } | null>(null);
	useEffect(() => {
		const doc = inputRef.current?.ownerDocument ?? document;
		const record = (event: globalThis.KeyboardEvent) => {
			if (event.key === "Escape") lastEscape.current = { event, open: panelOpenRef.current };
		};
		doc.addEventListener("keydown", record, true);
		return () => doc.removeEventListener("keydown", record, true);
	}, []);

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		// 只认调用方在自己的 onKeyDown 里对这次合成事件调用 preventDefault：
		// 站点根上常驻的 Radix 层会在文档捕获阶段对每个 Esc 先 preventDefault，原生 defaultPrevented 不可信
		let canceledByCaller = false;
		const nativePreventDefault = event.preventDefault;
		event.preventDefault = () => {
			canceledByCaller = true;
			nativePreventDefault.call(event);
		};
		try {
			onKeyDown?.(event);
		} finally {
			event.preventDefault = nativePreventDefault;
		}
		if (canceledByCaller || !editable) return;
		// 输入法选词期间的方向键与 Enter 属于输入法
		if (event.nativeEvent.isComposing || event.keyCode === 229) return;
		if (event.altKey || event.ctrlKey || event.metaKey) return;
		switch (event.key) {
			case "ArrowDown":
			case "ArrowUp":
				if (!panelOpen) {
					if (!hasPanel) return;
					event.preventDefault();
					openIntent.current = event.key === "ArrowDown" ? "first" : "last";
					listbox.setMode("keyboard");
					setOpen(true);
					return;
				}
				break;
			// 单行输入框里 Home、End 是移动光标
			case "Home":
			case "End":
				return;
			case "Enter": {
				const entry = panelOpen
					? view.entries.find((candidate) => candidate.id === listbox.activeId)
					: undefined;
				if (entry) {
					event.preventDefault();
					choose(entry);
				} else if (creatable && typed && inputText.trim()) {
					event.preventDefault();
					commitTyped(inputText.trim());
				}
				return;
			}
			case "Escape": {
				// 面板由 Radix 在文档捕获阶段收起，浏览器会在它之后、本回调之前提交这次更新，
				// 所以以按键开始时面板是否展开为准
				const seen = lastEscape.current;
				const wasOpen = seen?.event === event.nativeEvent ? seen.open : panelOpen;
				if (wasOpen) {
					event.preventDefault();
					setOpen(false);
				} else if (inputText !== "") {
					event.preventDefault();
					clear(false);
				}
				return;
			}
		}
		if (panelOpen && listbox.handleKeyDown(event)) event.preventDefault();
	};

	// 表单复位：一律回到 defaultValue（没给则回到空），受控的值也会收到 onValueChange；事件被取消时不复位
	const resetRef = useRef<() => void>(() => {});
	resetRef.current = () => {
		const initial = defaultValue ?? "";
		setValue(initial);
		setTyped(false);
		setInputText(defaultInputValue ?? labelOf(initial), "revert");
	};
	useEffect(() => {
		const byId = form ? document.getElementById(form) : null;
		const owner = byId instanceof HTMLFormElement ? byId : (inputRef.current?.form ?? null);
		if (!owner) return;
		const onReset = (event: Event) => {
			setTimeout(() => {
				if (!event.defaultPrevented) resetRef.current();
			}, 0);
		};
		owner.addEventListener("reset", onReset);
		return () => owner.removeEventListener("reset", onReset);
	}, [form]);

	// 外部改了已选值（或异步选项到齐、标签有了），没在键入时输入框跟着换成标签
	const synced = useRef({ value, label: selectedLabel });
	// biome-ignore lint/correctness/useExhaustiveDependencies: 只响应已选值与标签的变化
	useEffect(() => {
		const previous = synced.current;
		if (previous.value === value && previous.label === selectedLabel) return;
		synced.current = { value, label: selectedLabel };
		if (!typed) setInputText(selectedLabel, "select");
	}, [value, selectedLabel]);

	const ariaInvalid = ariaInvalidProp;
	const invalidState = isInvalid(invalid, ariaInvalid);
	const validState = valid && !invalidState;
	const canClear = clearable && editable && inputText !== "";
	const labelledBy = ariaLabel ? undefined : (labelledByProp ?? id);

	const closeOnBlur = (event: FocusEvent<HTMLElement>) => {
		const next = event.relatedTarget;
		if (next instanceof Node && shellRef.current?.contains(next)) return;
		if (next instanceof Element && next.closest("[data-slot=picker-panel]")) return;
		setOpen(false);
		settle();
	};

	// 点外壳的空白处（内边距、前后置槽）也聚焦输入区，且不让焦点先离开再回来
	const focusFromShell = (event: MouseEvent<HTMLDivElement>) => {
		if (event.button !== 0 || disabled) return;
		if ((event.target as Element).closest("button, input")) return;
		event.preventDefault();
		inputRef.current?.focus();
	};

	const liveText = !panelOpen
		? ""
		: busy
			? "正在查找"
			: view.mode === "empty"
				? typeof view.empty === "string"
					? view.empty
					: "没有匹配的项"
				: `${view.entries.filter((entry) => entry.option).length} 条建议`;

	const hasSelectionInput = name !== undefined;

	return (
		<>
			<div
				data-slot="combobox"
				ref={shellRef}
				style={style}
				data-state={panelOpen ? "open" : "closed"}
				data-invalid={invalidState ? "" : undefined}
				data-valid={validState ? "" : undefined}
				data-disabled={disabled ? "" : undefined}
				data-readonly={readOnly ? "" : undefined}
				data-loading={busy ? "" : undefined}
				className={inputVariants({
					variant,
					controlSize,
					className: cn("v-combobox", className),
				})}
				onMouseDown={focusFromShell}
			>
				{leading ? <span className="v-input-control__leading">{leading}</span> : null}
				<input
					autoComplete="off"
					{...props}
					ref={composedRef}
					id={id}
					data-slot="combobox-input"
					type="text"
					role="combobox"
					aria-autocomplete="list"
					aria-expanded={panelOpen}
					aria-controls={panelOpen ? listboxId : undefined}
					aria-activedescendant={panelOpen ? listbox.activeId : undefined}
					aria-label={ariaLabel}
					aria-labelledby={labelledByProp}
					aria-invalid={invalid === undefined ? ariaInvalid : invalid}
					aria-required={required || undefined}
					aria-busy={busy || undefined}
					disabled={disabled}
					readOnly={readOnly}
					value={inputText}
					className="v-input v-combobox__input"
					onChange={handleChange}
					onFocus={(event) => {
						onFocus?.(event);
						if (!event.defaultPrevented) setOpen(true);
					}}
					onBlur={(event) => {
						onBlur?.(event);
						closeOnBlur(event);
					}}
					onClick={(event) => {
						onClick?.(event);
						if (!event.defaultPrevented) setOpen(true);
					}}
					onKeyDown={handleKeyDown}
				/>
				{busy ? (
					<span className="v-input-control__status" data-status="loading">
						<Spinner size={16} aria-hidden="true" />
					</span>
				) : null}
				{canClear ? (
					<button
						type="button"
						className="v-input-control__action v-input-control__action--clear"
						aria-label="清除"
						onMouseDown={(event) => event.preventDefault()}
						onBlur={closeOnBlur}
						onClick={() => clear()}
					>
						<X aria-hidden="true" />
					</button>
				) : null}
				<span role="status" className="v-combobox__live">
					{liveText}
				</span>
			</div>
			<PickerPanel
				open={panelOpen}
				onOpenChange={setOpen}
				anchorRef={shellRef}
				container={container}
				collisionBoundary={collisionBoundary}
				className={cn("v-combobox-content", panelClassName)}
				onPlaced={() => setPlaced(true)}
			>
				<PickerList
					id={listboxId}
					mode={listbox.mode}
					aria-label={ariaLabel}
					aria-labelledby={labelledBy}
					hidden={view.entries.length === 0}
				>
					{toSegments(view.entries).map((segment, position) => {
						const rows = segment.rows.map(({ entry, index }) => (
							<ComboboxRow
								key={entry.id}
								entry={entry}
								index={index}
								listbox={listbox}
								selected={
									entry.option !== undefined && entry.option.value === value
								}
								needle={view.needle}
								highlight={highlight}
								onChoose={choose}
							/>
						));
						return segment.group ? (
							<PickerGroup key={`${segment.group}-${position}`}>
								<PickerLabel>{segment.group}</PickerLabel>
								{rows}
							</PickerGroup>
						) : (
							rows
						);
					})}
				</PickerList>
				{view.mode === "busy" ? (
					<PickerEmpty>
						<Spinner size={16} aria-hidden="true" />
						{view.needle ? "正在查找…" : "加载中…"}
					</PickerEmpty>
				) : view.mode === "empty" ? (
					<PickerEmpty>{view.empty}</PickerEmpty>
				) : null}
			</PickerPanel>
			{hasSelectionInput ? (
				<input type="hidden" name={name} form={form} value={value} disabled={disabled} />
			) : null}
		</>
	);
}
