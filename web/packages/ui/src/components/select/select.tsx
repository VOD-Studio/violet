"use client";

import { cn } from "cn";
import { ChevronsUpDown, X } from "lucide-react";
import { useComposedRefs, useControllableState } from "radix-ui/internal";
import {
	type ComponentProps,
	createContext,
	type FocusEvent,
	Fragment,
	isValidElement,
	type KeyboardEvent,
	type ReactNode,
	type RefObject,
	use,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import {
	PickerEmpty,
	PickerGroup,
	PickerLabel,
	PickerList,
	PickerOption,
	type PickerOptionProps,
	PickerPanel,
} from "../../lib/picker-panel";
import { type ListboxItem, type UseListboxResult, useListbox } from "../../lib/use-listbox";
import { iconProps } from "../icons";
import { Spinner } from "../indicator";
import { type InputVariantProps, inputVariants } from "../input/styles";

interface ItemRecord {
	/** 选项行的 DOM id，同时是引擎里的 id。 */
	key: string;
	value: string;
	label: string;
	disabled: boolean;
	element: HTMLElement;
}

interface SelectContextValue {
	multiple: boolean;
	values: string[];
	open: boolean;
	setOpen: (open: boolean, mode?: "keyboard" | "pointer") => void;
	choose: (value: string) => void;
	remove: (value: string) => void;
	clear: () => void;
	disabled: boolean;
	readOnly: boolean;
	required: boolean;
	loading: boolean;
	/** 真正拿焦点的元素；单选是触发器按钮，多选是外壳里的展开钮。 */
	triggerRef: RefObject<HTMLElement | null>;
	/** 面板的定位与宽度锚点：单选是触发器本身，多选是整个外壳。 */
	anchorRef: RefObject<HTMLElement | null>;
	listboxId: string;
	records: ItemRecord[];
	/** 服务端与水合前的选项文字：此时选项还没挂载登记，已选值用它显示。 */
	staticLabels: ReadonlyMap<string, string>;
	/** 表单项经根传来的接线属性，触发器自己的同名属性优先。 */
	field: SelectFieldProps;
	/** 选项行 key 到引擎下标的映射。 */
	indexOf: ReadonlyMap<string, number>;
	listbox: UseListboxResult;
	register: (record: ItemRecord) => void;
	unregister: (key: string) => void;
	panelPresent: boolean;
	setPanelPresent: (present: boolean) => void;
}

const SelectContext = createContext<SelectContextValue | null>(null);

function useSelectContext(part: string): SelectContextValue {
	const context = use(SelectContext);
	if (!context) throw new Error(`${part} 必须放在 Select 内`);
	return context;
}

function byDocumentOrder(a: ItemRecord, b: ItemRecord) {
	if (a.element === b.element) return 0;
	return a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

/** 选项标题 span 的 textContent 在纯 React 子树上的等价物：拼接全部文本子节点。 */
function nodeText(node: ReactNode): string {
	if (typeof node === "string") return node;
	if (typeof node === "number") return String(node);
	if (Array.isArray(node)) return node.map(nodeText).join("");
	if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children);
	return "";
}

interface StaticItemProps {
	children?: ReactNode;
	value?: string;
	textValue?: string;
}

/**
 * 静态取选项文字：只透传数组、Fragment、`SelectContent` 与 `SelectGroup` 这些透明容器，
 * 自定义包装组件里面的 `SelectItem` 取不到（选项挂载后由实时登记接上）。
 */
function collectStaticLabels(node: ReactNode, into: Map<string, string>) {
	if (Array.isArray(node)) {
		for (const child of node) collectStaticLabels(child, into);
		return;
	}
	if (!isValidElement<StaticItemProps>(node)) return;
	if (node.type === SelectItem) {
		const { value } = node.props;
		if (value !== undefined && !into.has(value)) {
			into.set(
				value,
				node.props.textValue ?? (nodeText(node.props.children).trim() || value),
			);
		}
		return;
	}
	if (node.type === SelectContent || node.type === SelectGroup || node.type === Fragment) {
		collectStaticLabels(node.props.children, into);
	}
}

/** 表单项（`Field`）克隆到根上的接线属性；它们落到真正可聚焦的触发器上。 */
interface SelectFieldProps {
	/** 落在触发器上，表单项的标签 `for` 才命中它；触发器自己的 `id` 优先。 */
	id?: string;
	/** 与触发器自己的取并集。 */
	"aria-describedby"?: string;
	"aria-labelledby"?: string;
	"aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling";
}

interface SelectBaseProps extends SelectFieldProps {
	/** 表单字段名；给了才渲染隐藏输入参与 FormData（多选每个值一个）。 */
	name?: string;
	/** 隐藏输入所属表单的 id，对应原生 `form` 属性。 */
	form?: string;
	disabled?: boolean;
	/** 只读：可聚焦、可读屏，但不能展开，也没有箭头。 */
	readOnly?: boolean;
	/** 写入触发器的 `aria-required`；隐藏输入不参与原生必填校验。 */
	required?: boolean;
	/** 触发器显示加载指示、`aria-busy`，没有选项时面板显示「加载中…」；子部件上的同名属性优先。 */
	loading?: boolean;
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	children?: ReactNode;
}

/** 单选：值是 `string`，空串表示没有选择。 */
export interface SelectSingleProps extends SelectBaseProps {
	multiple?: false;
	value?: string;
	defaultValue?: string;
	onValueChange?: (value: string) => void;
}

/** 多选：值是 `string[]`；选中后面板不收起。 */
export interface SelectMultipleProps extends SelectBaseProps {
	multiple: true;
	value?: string[];
	defaultValue?: string[];
	onValueChange?: (value: string[]) => void;
}

export type SelectProps = SelectSingleProps | SelectMultipleProps;

/**
 * 从固定的几项里选一个或几个的选择器。组合式 API：`SelectTrigger` 里放 `SelectValue`，
 * `SelectContent` 里放 `SelectItem`（可用 `SelectGroup` 与 `SelectLabel` 分组）。
 *
 * 焦点始终留在触发器，高亮项靠 `aria-activedescendant` 告知读屏；需要边输入边筛选或接受自由输入时用 combobox。
 * 面板关闭时，`SelectContent` 的子节点渲染进游离的文档片段，让选项登记自己的文字，
 * 所以已选项的文字关闭时也能显示；它们不进入文档，也不进入无障碍树。
 */
export function Select(props: SelectProps) {
	const {
		multiple = false,
		name,
		form,
		disabled = false,
		readOnly = false,
		required = false,
		loading = false,
		open: openProp,
		defaultOpen = false,
		onOpenChange,
		children,
	} = props;
	const field = useMemo<SelectFieldProps>(
		() => ({
			id: props.id,
			"aria-describedby": props["aria-describedby"],
			"aria-labelledby": props["aria-labelledby"],
			"aria-invalid": props["aria-invalid"],
		}),
		[props.id, props["aria-describedby"], props["aria-labelledby"], props["aria-invalid"]],
	);
	// 服务端首帧与水合前，选项还没挂载，从复合子树静态读已选项的文字；挂载后实时登记接管
	const staticLabels = useMemo(() => {
		const map = new Map<string, string>();
		collectStaticLabels(children, map);
		return map;
	}, [children]);
	const listboxId = useId();
	const triggerRef = useRef<HTMLElement | null>(null);
	const anchorRef = useRef<HTMLElement | null>(null);

	const emptyValue = multiple ? [] : "";
	const [raw = emptyValue, setRaw] = useControllableState<string | string[]>({
		prop: props.value,
		defaultProp: props.defaultValue ?? emptyValue,
		onChange: props.onValueChange as ((value: string | string[]) => void) | undefined,
	});
	const values = useMemo(() => (Array.isArray(raw) ? raw : raw ? [raw] : []), [raw]);

	const [openState = false, setOpenState] = useControllableState({
		prop: openProp,
		defaultProp: defaultOpen,
		onChange: onOpenChange,
	});
	const open = openState && !disabled && !readOnly;

	const recordsRef = useRef(new Map<string, ItemRecord>());
	const [version, setVersion] = useState(0);
	const register = useCallback((record: ItemRecord) => {
		const previous = recordsRef.current.get(record.key);
		if (
			previous &&
			previous.value === record.value &&
			previous.label === record.label &&
			previous.disabled === record.disabled &&
			previous.element === record.element
		) {
			return;
		}
		recordsRef.current.set(record.key, record);
		setVersion((current) => current + 1);
	}, []);
	const unregister = useCallback((key: string) => {
		if (recordsRef.current.delete(key)) setVersion((current) => current + 1);
	}, []);
	// biome-ignore lint/correctness/useExhaustiveDependencies: 登记表在 ref 里，version 是它变化的信号
	const records = useMemo(
		() => [...recordsRef.current.values()].sort(byDocumentOrder),
		[version],
	);
	// 展开后只有文档里的那一份选项参与键盘导航；关闭态游离片段里的那份只提供文字
	const live = useMemo(() => records.filter((record) => record.element.isConnected), [records]);
	const items = useMemo<ListboxItem[]>(
		() =>
			open
				? live.map((record) => ({
						id: record.key,
						disabled: record.disabled,
						textValue: record.label,
					}))
				: [],
		[live, open],
	);
	const indexOf = useMemo(() => new Map(items.map((item, index) => [item.id, index])), [items]);

	const initialActiveId = live.find((record) => values.includes(record.value))?.key ?? null;
	const listbox = useListbox({
		items,
		open,
		typeahead: true,
		activateFirst: true,
		initialActiveId,
	});

	const [panelPresent, setPanelPresent] = useState(false);

	const setOpen = useCallback(
		(next: boolean, mode: "keyboard" | "pointer" = "pointer") => {
			if (next && (disabled || readOnly)) return;
			listbox.setMode(mode);
			setOpenState(next);
		},
		[disabled, readOnly, listbox.setMode, setOpenState],
	);

	const commit = (next: string[]) => setRaw(multiple ? next : (next[0] ?? ""));
	const choose = (value: string) => {
		if (disabled || readOnly) return;
		if (multiple) {
			commit(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
			return;
		}
		commit([value]);
		setOpenState(false);
		triggerRef.current?.focus({ preventScroll: true });
	};
	const remove = (value: string) => {
		if (disabled || readOnly) return;
		commit(values.filter((v) => v !== value));
	};
	const clear = () => {
		if (disabled || readOnly) return;
		commit([]);
	};

	// 表单复位：不论受控与否都回到 defaultValue（没给则回到空），受控时由 onValueChange 通知调用方；
	// 事件被取消时不复位。监听的表单不依赖隐藏输入是否存在（多选清空后隐藏输入全部卸载）。
	const resetRef = useRef<() => void>(() => {});
	resetRef.current = () => setRaw(props.defaultValue ?? emptyValue);
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

	const context: SelectContextValue = {
		multiple,
		values,
		open,
		setOpen,
		choose,
		remove,
		clear,
		disabled,
		readOnly,
		required,
		loading,
		triggerRef,
		anchorRef,
		listboxId,
		field,
		records,
		staticLabels,
		indexOf,
		listbox,
		register,
		unregister,
		panelPresent,
		setPanelPresent,
	};

	return (
		<SelectContext value={context}>
			{children}
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
		</SelectContext>
	);
}

/** 选项集合：把一组选项收在一个 `role="group"` 里，名称取自 `SelectLabel`。 */
export function SelectGroup(props: ComponentProps<typeof PickerGroup>) {
	return <PickerGroup data-slot="select-group" {...props} />;
}

export interface SelectValueProps extends Omit<ComponentProps<"span">, "children"> {
	/** 没有选择时显示的占位文字，次级文字色。 */
	placeholder?: ReactNode;
	/** 自定义已选值的呈现；没有选择时仍显示占位。多选由触发器画芯片，不用它。 */
	children?: ReactNode;
}

/** 触发器里的值：已选项的文字（关闭时也有），没有选择时是占位。 */
export function SelectValue({ className, placeholder, children, ...props }: SelectValueProps) {
	const context = useSelectContext("SelectValue");
	const hasValue = context.values.length > 0;
	if (context.multiple) {
		// 有值时芯片在展开钮外面；展开钮里留一份视觉隐藏的占位，没有 aria-label 与标签时用它做可访问名称
		return (
			<span
				data-slot="select-value"
				data-placeholder={hasValue ? undefined : ""}
				data-sr={hasValue ? "" : undefined}
				id={`${context.listboxId}-placeholder`}
				{...props}
				className={cn("v-select-value", hasValue && "v-select-sr", className)}
			>
				{placeholder}
			</span>
		);
	}
	const label = hasValue
		? (context.records.find((record) => record.value === context.values[0])?.label ??
			context.staticLabels.get(context.values[0]))
		: undefined;
	return (
		<span
			data-slot="select-value"
			data-placeholder={hasValue ? undefined : ""}
			{...props}
			className={cn("v-select-value", className)}
		>
			{hasValue ? (children ?? label) : placeholder}
		</span>
	);
}

export interface SelectTriggerProps
	extends Omit<ComponentProps<"button">, "type" | "role" | "children">,
		InputVariantProps {
	children?: ReactNode;
	/** 出错外观，并写入 `aria-invalid`；显式值优先于传入的 `aria-invalid`。 */
	invalid?: boolean;
	/** 通过外观（成功色），只是视觉反馈。 */
	valid?: boolean;
	/** 尾部箭头换成加载指示，并设 `aria-busy`；缺省取 `Select` 的 `loading`。 */
	loading?: boolean;
	/** 多选最多画几个芯片，其余折成「+N」。默认 2。 */
	maxChips?: number;
}

function useTriggerKeys() {
	const context = useSelectContext("SelectTrigger");
	const { open, listbox, records, choose, setOpen, triggerRef } = context;

	const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
		if (event.defaultPrevented || context.disabled || context.readOnly) return;
		if (event.altKey || event.ctrlKey || event.metaKey) return;
		if (!open) {
			if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
				event.preventDefault();
				setOpen(true, "keyboard");
			}
			return;
		}
		// 空格选中高亮项优先于前缀预测输入：键入前缀后空格仍然是确认
		if (event.key === " " && listbox.activeId) {
			event.preventDefault();
			const record = records.find((item) => item.key === listbox.activeId);
			if (record && !record.disabled) choose(record.value);
			return;
		}
		if (listbox.handleKeyDown(event)) {
			event.preventDefault();
			return;
		}
		switch (event.key) {
			case "Enter": {
				event.preventDefault();
				const record = records.find((item) => item.key === listbox.activeId);
				if (record && !record.disabled) choose(record.value);
				break;
			}
			case "Escape":
				event.preventDefault();
				setOpen(false);
				triggerRef.current?.focus({ preventScroll: true });
				break;
			case "Tab":
				// 去下一个控件：关闭但不还焦点
				setOpen(false);
				break;
		}
	};

	// 空格的点击在 keyup 才发生，展开已经由 keydown 完成，这里拦掉避免立刻又收起
	const onKeyUp = (event: KeyboardEvent<HTMLElement>) => {
		if (event.key === " ") event.preventDefault();
	};

	return { onKeyDown, onKeyUp };
}

function useCloseOnBlurOutside() {
	const { open, setOpen, anchorRef } = useSelectContext("SelectTrigger");
	return (event: FocusEvent<HTMLElement>) => {
		if (!open) return;
		const next = event.relatedTarget;
		if (next instanceof Node) {
			if (anchorRef.current?.contains(next)) return;
			if (next instanceof Element && next.closest("[data-slot=picker-panel]")) return;
		}
		setOpen(false);
	};
}

function isInvalid(invalid: boolean | undefined, ariaInvalid: SelectTriggerProps["aria-invalid"]) {
	return (
		invalid ??
		(ariaInvalid === true ||
			ariaInvalid === "true" ||
			ariaInvalid === "grammar" ||
			ariaInvalid === "spelling")
	);
}

/**
 * 触发器：复用输入框外壳（四变体、三档尺寸、出错/通过/加载/只读/禁用状态）的 `role="combobox"` 按钮。
 * 多选时外壳是 `div`，已选项以芯片排在展开钮之前，展开钮才是真正的 combobox。
 */
export function SelectTrigger({
	ref,
	className,
	style,
	variant,
	controlSize,
	invalid,
	valid = false,
	loading: loadingProp,
	maxChips = 2,
	disabled: disabledProp,
	children,
	onClick,
	onKeyDown,
	onKeyUp,
	onBlur,
	id,
	"aria-invalid": ariaInvalidProp,
	"aria-describedby": describedByProp,
	"aria-labelledby": labelledByProp,
	...props
}: SelectTriggerProps) {
	const context = useSelectContext("SelectTrigger");
	const ariaInvalid = ariaInvalidProp ?? context.field["aria-invalid"];
	const describedBy =
		[describedByProp, context.field["aria-describedby"]].filter(Boolean).join(" ") || undefined;
	const keys = useTriggerKeys();
	const closeOnBlur = useCloseOnBlurOutside();
	const disabled = context.disabled || Boolean(disabledProp);
	const loading = loadingProp ?? context.loading;
	const invalidState = isInvalid(invalid, ariaInvalid);
	const validState = valid && !invalidState;
	const buttonRef = useRef<HTMLButtonElement | null>(null);
	const composedRef = useComposedRefs(ref, buttonRef, (node: HTMLButtonElement | null) => {
		context.triggerRef.current = node;
	});
	const shellRef = useRef<HTMLDivElement | null>(null);
	const setAnchor = useComposedRefs(shellRef, (node: HTMLDivElement | null) => {
		if (context.multiple) context.anchorRef.current = node;
	});
	const singleAnchor = useComposedRefs(composedRef, (node: HTMLButtonElement | null) => {
		if (!context.multiple) context.anchorRef.current = node;
	});

	const shared = {
		id: id ?? context.field.id,
		"aria-describedby": describedBy,
		"aria-labelledby": labelledByProp ?? context.field["aria-labelledby"],
		"aria-haspopup": "listbox" as const,
		"aria-controls": context.listboxId,
		"aria-activedescendant": context.open ? context.listbox.activeId : undefined,
		"aria-invalid": invalid === undefined ? ariaInvalid : invalid,
		"aria-required": context.required || undefined,
		"aria-readonly": context.readOnly || undefined,
		"aria-busy": loading || undefined,
		disabled,
	};
	const stateAttrs = {
		"data-state": context.open ? "open" : "closed",
		"data-invalid": invalidState ? "" : undefined,
		"data-valid": validState ? "" : undefined,
		"data-disabled": disabled ? "" : undefined,
		"data-readonly": context.readOnly ? "" : undefined,
		"data-loading": loading ? "" : undefined,
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		onKeyDown?.(event);
		keys.onKeyDown(event);
	};
	const handleKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
		onKeyUp?.(event);
		keys.onKeyUp(event);
	};
	const toggle = () => {
		if (disabled || context.readOnly) return;
		// Safari 点按钮不聚焦，键盘操作需要焦点在触发器上
		buttonRef.current?.focus({ preventScroll: true });
		context.setOpen(!context.open, "pointer");
	};

	const trailing = loading ? (
		<span className="v-input-control__status" data-status="loading">
			<Spinner size={16} aria-hidden="true" />
		</span>
	) : context.readOnly ? null : (
		<span className="v-input-control__trailing" aria-hidden="true">
			<ChevronsUpDown />
		</span>
	);

	if (!context.multiple) {
		return (
			<button
				data-slot="select-trigger"
				{...props}
				{...shared}
				{...stateAttrs}
				ref={singleAnchor}
				type="button"
				role="combobox"
				aria-expanded={context.open}
				style={style}
				className={inputVariants({
					variant,
					controlSize,
					className: cn("v-select-trigger", className),
				})}
				onClick={(event) => {
					onClick?.(event);
					if (!event.defaultPrevented) toggle();
				}}
				onKeyDown={handleKeyDown}
				onKeyUp={handleKeyUp}
				onBlur={(event) => {
					onBlur?.(event);
					closeOnBlur(event);
				}}
			>
				{children}
				{trailing}
			</button>
		);
	}

	const chips = context.values;
	const shown = chips.slice(0, maxChips);
	const hidden = chips.length - shown.length;
	const labelOf = (value: string) =>
		context.records.find((record) => record.value === value)?.label ??
		context.staticLabels.get(value) ??
		value;
	const editable = !disabled && !context.readOnly;
	const summaryId = `${context.listboxId}-summary`;
	// combobox 角色不从内容取名：没有 aria-label、aria-labelledby 与 id（也就没有 label for）时，
	// 用 SelectValue 里的占位文案兜底，避免展开钮没有名称
	const named =
		props["aria-label"] !== undefined || shared["aria-labelledby"] !== undefined || shared.id;
	const fallbackLabelledBy = named ? undefined : `${context.listboxId}-placeholder`;
	const summary =
		chips.length === 0
			? null
			: chips.length <= 2
				? `已选 ${chips.map(labelOf).join("、")}`
				: `已选 ${chips.slice(0, 2).map(labelOf).join("、")} 等 ${chips.length} 项`;

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: 外壳空白处的点击只是展开钮的放大热区，键盘走展开钮
		<div
			data-slot="select-trigger"
			{...stateAttrs}
			ref={setAnchor}
			style={style}
			className={inputVariants({
				variant,
				controlSize,
				className: cn("v-select-trigger v-select-trigger--multiple", className),
			})}
			onMouseDown={(event) => {
				if (event.button !== 0 || (event.target as Element).closest("button")) return;
				event.preventDefault();
			}}
			onClick={(event) => {
				if ((event.target as Element).closest("button")) return;
				toggle();
			}}
			onBlur={closeOnBlur}
		>
			{shown.map((value) => (
				<span key={value} className="v-select-chip">
					<span className="v-select-chip__label">{labelOf(value)}</span>
					{editable ? (
						<button
							type="button"
							tabIndex={-1}
							className="v-select-chip__remove"
							aria-label={`移除 ${labelOf(value)}`}
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => context.remove(value)}
						>
							<X {...iconProps(12)} aria-hidden="true" />
						</button>
					) : null}
				</span>
			))}
			{hidden > 0 ? (
				<span className="v-select-chip v-select-chip--more">+{hidden}</span>
			) : null}
			<button
				data-slot="select-toggle"
				{...props}
				{...shared}
				aria-labelledby={shared["aria-labelledby"] ?? fallbackLabelledBy}
				aria-describedby={
					[shared["aria-describedby"], summary ? summaryId : undefined]
						.filter(Boolean)
						.join(" ") || undefined
				}
				ref={composedRef}
				type="button"
				role="combobox"
				aria-expanded={context.open}
				className="v-select-trigger__toggle"
				onClick={(event) => {
					onClick?.(event);
					if (!event.defaultPrevented) toggle();
				}}
				onKeyDown={handleKeyDown}
				onKeyUp={handleKeyUp}
				onBlur={onBlur}
			>
				{children}
			</button>
			{summary ? (
				<span id={summaryId} className="v-select-sr">
					{summary}
				</span>
			) : null}
			{editable && chips.length > 0 ? (
				<button
					type="button"
					className="v-input-control__action v-input-control__action--clear"
					aria-label="清除全部"
					onMouseDown={(event) => event.preventDefault()}
					onClick={() => {
						context.clear();
						// 按钮随即卸载，焦点还给展开钮
						buttonRef.current?.focus({ preventScroll: true });
					}}
				>
					<X {...iconProps(14)} aria-hidden="true" />
				</button>
			) : null}
			{trailing}
		</div>
	);
}

export interface SelectContentProps {
	className?: string;
	/** 挂载面板的容器；默认 `document.body`。带缩放的宿主需要传入。 */
	container?: HTMLElement | null;
	/** 判断「放不下」的边界，默认视口；局部宿主可与 `container` 一起指定。 */
	collisionBoundary?: Element | null;
	/** 没有选项时的内容，默认「无选项」。 */
	empty?: ReactNode;
	/** 没有选项且在加载时显示 Spinner 与「加载中…」；缺省取 `Select` 的 `loading`。 */
	loading?: boolean;
	children?: ReactNode;
}

/**
 * 选项面板：在触发器下方与它同宽，放不下翻到上方；最高 264px，超出原生滚动。
 * 位置固定，不提供对齐与偏移。
 */
export function SelectContent({
	className,
	container,
	collisionBoundary,
	empty = "无选项",
	loading: loadingProp,
	children,
}: SelectContentProps) {
	const context = useSelectContext("SelectContent");
	const { open, panelPresent, listbox } = context;
	const loading = loadingProp ?? context.loading;
	const [fragment, setFragment] = useState<DocumentFragment | null>(null);
	useLayoutEffect(() => setFragment(document.createDocumentFragment()), []);

	const [placed, setPlaced] = useState(false);
	const centered = useRef(false);
	useEffect(() => {
		if (!open) {
			setPlaced(false);
			centered.current = false;
		}
	}, [open]);
	// 展开后第一次有高亮项且面板已定位时，把已选项滚到列表中间
	useEffect(() => {
		if (!open || !placed || centered.current || !listbox.activeId) return;
		centered.current = true;
		listbox.scrollActiveIntoView("center");
	}, [open, placed, listbox.activeId, listbox.scrollActiveIntoView]);

	const showPanel = open || panelPresent;
	const trigger = context.triggerRef.current;
	const ariaLabel = trigger?.getAttribute("aria-label") ?? undefined;
	const labelledBy = ariaLabel
		? undefined
		: (trigger?.getAttribute("aria-labelledby") ?? trigger?.id);
	const hasItems = context.records.length > 0;

	return (
		<>
			{!showPanel && fragment ? createPortal(children, fragment) : null}
			{showPanel ? (
				<PickerPanel
					open={open}
					onOpenChange={(next) => context.setOpen(next)}
					anchorRef={context.anchorRef}
					container={container}
					collisionBoundary={collisionBoundary}
					className={cn("v-select-content", className)}
					onPlaced={() => setPlaced(true)}
					onPresenceChange={context.setPanelPresent}
				>
					<PickerList
						id={context.listboxId}
						mode={listbox.mode}
						multiselectable={context.multiple}
						aria-label={ariaLabel}
						aria-labelledby={labelledBy}
						hidden={!hasItems}
					>
						{children}
					</PickerList>
					{hasItems ? null : loading ? (
						<PickerEmpty role="status">
							<Spinner size={16} aria-hidden="true" />
							加载中…
						</PickerEmpty>
					) : (
						<PickerEmpty>{empty}</PickerEmpty>
					)}
				</PickerPanel>
			) : null}
		</>
	);
}

/** 分组标签。 */
export function SelectLabel(props: ComponentProps<typeof PickerLabel>) {
	return <PickerLabel data-slot="select-label" {...props} />;
}

export interface SelectItemProps
	extends Omit<PickerOptionProps, "selected" | "indicator" | "textRef" | "onSelect"> {
	value: string;
	disabled?: boolean;
	/** 选项的文字标签，用于触发器显示、前缀预测输入与芯片；缺省取 children 的文本。 */
	textValue?: string;
}

/** 一个选项。`icon` 是 32px 图标块，`description` 使选项变成两行，`meta` 是右侧附加信息。 */
export function SelectItem({
	value,
	disabled = false,
	textValue,
	children,
	onClick,
	onPointerMove,
	ref,
	...props
}: SelectItemProps) {
	const context = useSelectContext("SelectItem");
	const { register, unregister, listbox } = context;
	const key = useId();
	const [element, setElement] = useState<HTMLElement | null>(null);
	const textRef = useRef<HTMLSpanElement | null>(null);
	const composedRef = useComposedRefs(ref, setElement);

	useLayoutEffect(() => {
		if (!element) return;
		register({
			key,
			value,
			disabled,
			element,
			label: textValue ?? textRef.current?.textContent?.trim() ?? value,
		});
	});
	useLayoutEffect(() => () => unregister(key), [key, unregister]);
	useLayoutEffect(() => {
		listbox.registerItem(key, element);
		return () => listbox.registerItem(key, null);
	}, [key, element, listbox.registerItem]);

	const selected = context.values.includes(value);
	const index = context.indexOf.get(key) ?? -1;
	const { onPointerMove: enginePointerMove, ...itemProps } =
		index >= 0
			? listbox.getItemProps(index, { selected })
			: {
					id: key,
					role: "option" as const,
					"aria-selected": selected,
					"aria-disabled": disabled || undefined,
					onPointerMove: undefined,
				};

	return (
		<PickerOption
			data-slot="select-item"
			{...props}
			{...itemProps}
			ref={composedRef}
			textRef={textRef}
			selected={selected}
			indicator={context.multiple ? "checkbox" : "check"}
			onPointerMove={(event) => {
				onPointerMove?.(event);
				if (!event.defaultPrevented) enginePointerMove?.(event);
			}}
			onClick={(event) => {
				// 禁用项不响应任何点击，调用方的 onClick 也不执行
				if (disabled) return;
				onClick?.(event);
				if (!event.defaultPrevented) context.choose(value);
			}}
		>
			{children}
		</PickerOption>
	);
}

/** 分隔线：设计稿的选项组之间不画线，只占一个很小的间隔。 */
export function SelectSeparator({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="select-separator"
			aria-hidden="true"
			{...props}
			className={cn("v-select-separator", className)}
		/>
	);
}
