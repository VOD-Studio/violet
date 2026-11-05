"use client";

import { cn } from "cn";
import {
	type ButtonHTMLAttributes,
	Children,
	createContext,
	type HTMLAttributes,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";

/** 组内单项的登记表：值 → 是否禁用，插入顺序即 DOM 顺序。 */
type ItemRegistry = Map<string, boolean>;

interface ToggleGroupContextValue {
	/** 整组禁用；单项的 disabled 与之取或 */
	groupDisabled: boolean;
	/** 该项当前是否按下 */
	isPressed: (value: string) => boolean;
	/** 点击启用项时切换按下状态并上报 */
	toggle: (value: string) => void;
	/** 漫游 Tab 停靠项；null 表示没有可停靠的启用项 */
	tabValue: string | null;
	/** 焦点落到某项（含点击带来的聚焦） */
	focusItem: (value: string) => void;
	register: (value: string, disabled: boolean) => void;
	unregister: (value: string) => void;
}

const ToggleGroupContext = createContext<ToggleGroupContextValue | null>(null);

interface ToggleGroupBaseProps
	extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "defaultValue"> {
	/** 轨道形是凹陷色药丸轨道；bare 是无轨道的工具栏幽灵钮 */
	variant?: "track" | "bare";
	/** 语义角色；toolbar 会额外暴露 aria-orientation */
	role?: "group" | "toolbar";
	/** 排布方向，同时决定方向键映射：横向 ← →，竖向 ↑ ↓ */
	orientation?: "horizontal" | "vertical";
	/** 整组禁用 */
	disabled?: boolean;
	children: React.ReactNode;
	ref?: React.Ref<HTMLDivElement>;
}

/** 单选可取消形态：最多一个按下，再点已按下的项回到都不选；`""` 表示没有按下项。 */
export interface ToggleGroupSingleProps extends ToggleGroupBaseProps {
	type: "single";
	value?: string;
	defaultValue?: string;
	onValueChange?: (value: string) => void;
}

/** 多选形态：任意多项可以同时按下，再点抬起点。 */
export interface ToggleGroupMultipleProps extends ToggleGroupBaseProps {
	type: "multiple";
	value?: string[];
	defaultValue?: string[];
	onValueChange?: (value: string[]) => void;
}

export type ToggleGroupProps = ToggleGroupSingleProps | ToggleGroupMultipleProps;

/**
 * 开关组：一排各自按下的按钮。单项是原生 button 加 aria-pressed，
 * 整组只有一个 Tab 位置，方向键在启用项之间移动焦点而不改变按下状态。
 */
export function ToggleGroup(props: ToggleGroupProps) {
	const {
		type,
		variant = "track",
		role = "group",
		orientation = "horizontal",
		disabled = false,
		children,
		className,
		onKeyDown,
		ref,
		...native
	} = props;
	const [registry, setRegistry] = useState<ItemRegistry>(() => new Map());
	const [focusValue, setFocusValue] = useState<string | null>(null);
	const [internal, setInternal] = useState<string[]>(() =>
		type === "single"
			? props.defaultValue
				? [props.defaultValue]
				: []
			: props.defaultValue
				? [...props.defaultValue]
				: [],
	);

	// 按下状态统一归一为值列表：单选是 0 或 1 个，多选任意个；受控优先，空串表示都不选
	const currentList =
		props.value !== undefined
			? type === "single"
				? props.value
					? [props.value]
					: []
				: props.value
			: internal;
	const pressedSet = new Set(currentList);

	const register = useCallback((value: string, itemDisabled: boolean) => {
		setRegistry((prev) => {
			if (prev.get(value) === itemDisabled) return prev;
			const next = new Map(prev);
			next.set(value, itemDisabled);
			return next;
		});
	}, []);

	const unregister = useCallback((value: string) => {
		setRegistry((prev) => {
			if (!prev.has(value)) return prev;
			const next = new Map(prev);
			next.delete(value);
			return next;
		});
	}, []);

	const focusItem = useCallback((value: string) => setFocusValue(value), []);

	const isPressed = (value: string) => pressedSet.has(value);

	const toggle = (itemValue: string) => {
		// 单选换成新值或抬起点，多选在列表里增删
		const next =
			type === "single"
				? pressedSet.has(itemValue)
					? []
					: [itemValue]
				: pressedSet.has(itemValue)
					? currentList.filter((value) => value !== itemValue)
					: [...currentList, itemValue];
		if (props.value === undefined) setInternal(next);
		if (props.type === "single" && props.onValueChange) props.onValueChange(next[0] ?? "");
		if (props.type === "multiple" && props.onValueChange) props.onValueChange(next);
	};

	// 漫游 Tab 停靠：焦点（或最后聚焦）项优先，其次是第一个按下的启用项，最后是第一个启用项
	const enabledValues: string[] = [];
	for (const [value, itemDisabled] of registry) {
		if (!itemDisabled) enabledValues.push(value);
	}
	const focusEnabled =
		focusValue !== null && registry.get(focusValue) === false ? focusValue : null;
	const tabValue =
		focusEnabled ??
		enabledValues.find((value) => pressedSet.has(value)) ??
		enabledValues[0] ??
		null;

	const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		onKeyDown?.(event);
		if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
		const [prevKey, nextKey] =
			orientation === "vertical" ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"];
		if (![prevKey, nextKey, "Home", "End"].includes(event.key)) return;

		const items = Array.from(event.currentTarget.children).filter(
			(child): child is HTMLButtonElement =>
				child instanceof HTMLButtonElement && !child.disabled,
		);
		const current = items.findIndex(
			(item) => item === event.target || item.contains(event.target as Node),
		);
		if (current < 0) return;

		let next = current;
		if (event.key === nextKey) next = (current + 1) % items.length;
		else if (event.key === prevKey) next = (current - 1 + items.length) % items.length;
		else if (event.key === "Home") next = 0;
		else next = items.length - 1;

		event.preventDefault();
		items[next]?.focus();
	};

	return (
		// biome-ignore lint/a11y/useAriaPropsSupportedByRole: role 是动态值；toolbar 才会带 aria-orientation，group 角色下该属性保持 undefined
		<div
			{...native}
			ref={ref}
			role={role}
			aria-orientation={role === "toolbar" ? orientation : undefined}
			data-orientation={orientation}
			data-variant={variant}
			data-disabled={disabled ? "" : undefined}
			className={cn("v-toggle-group", className)}
			onKeyDown={handleKeyDown}
		>
			<ToggleGroupContext.Provider
				value={{
					groupDisabled: disabled,
					isPressed,
					toggle,
					tabValue,
					focusItem,
					register,
					unregister,
				}}
			>
				{children}
			</ToggleGroupContext.Provider>
		</div>
	);
}

export interface ToggleGroupItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	/** 该项的取值；按下状态与回调载荷都以它为准 */
	value: string;
	ref?: React.Ref<HTMLButtonElement>;
}

/**
 * 开关组单项：原生 button 加 aria-pressed。只有图标时用 aria-label 写动作、title 带文字提示；
 * 带文字的项内边距自动加宽。
 */
export function ToggleGroupItem({
	value,
	disabled: itemDisabled,
	className,
	children,
	onFocus,
	onClick,
	ref,
	...props
}: ToggleGroupItemProps) {
	const group = useContext(ToggleGroupContext);
	const register = group?.register;
	const unregister = group?.unregister;
	const disabled = (group?.groupDisabled ?? false) || itemDisabled === true;

	useEffect(() => {
		register?.(value, disabled);
	}, [value, disabled, register]);

	useEffect(() => () => unregister?.(value), [value, unregister]);

	if (!group) {
		throw new Error("ToggleGroupItem 必须渲染在 ToggleGroup 内");
	}

	// 文字出现时（图标旁或单独）内边距加宽，纯图标保持圆钮
	const hasText = Children.toArray(children).some(
		(child) => (typeof child === "string" && child.trim() !== "") || typeof child === "number",
	);

	return (
		<button
			{...props}
			ref={ref}
			type="button"
			data-text={hasText ? "" : undefined}
			aria-pressed={group.isPressed(value)}
			disabled={disabled}
			tabIndex={disabled || group.tabValue !== value ? -1 : 0}
			className={cn("v-toggle-group__item", className)}
			onFocus={(event) => {
				onFocus?.(event);
				group.focusItem(value);
			}}
			onClick={(event) => {
				onClick?.(event);
				if (!event.defaultPrevented && !disabled) group.toggle(value);
			}}
		>
			{children}
		</button>
	);
}

export interface ToggleGroupSeparatorProps extends HTMLAttributes<HTMLSpanElement> {
	ref?: React.Ref<HTMLSpanElement>;
}

/** 工具栏形态里两组之间的间距；纯装饰，对读屏隐藏，不参与键盘漫游。 */
export function ToggleGroupSeparator({ className, ref, ...props }: ToggleGroupSeparatorProps) {
	return (
		<span
			{...props}
			ref={ref}
			aria-hidden="true"
			className={cn("v-toggle-group__separator", className)}
		/>
	);
}
