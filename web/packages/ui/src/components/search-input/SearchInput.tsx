"use client";

import { cn } from "cn";
import { Loader2, Search, X } from "lucide-react";
import { type ComponentProps, useCallback, useId, useRef, useState } from "react";
import { useDebouncedCallback } from "../../lib/use-debounced-callback";

/** 防抖搜索保留 input 的原生属性、键盘事件和 ref；className 作用于外壳。 */
export interface SearchInputProps
	extends Omit<ComponentProps<"input">, "value" | "onChange" | "type" | "size"> {
	/** 受控值；传则受控，须配 onValueChange 回写 */
	value?: string;
	/** 非受控初值 */
	defaultValue?: string;
	/** 实时值回调（每次击键，未经防抖） */
	onValueChange?: (value: string) => void;
	/** 静默期结束后搜索；非输入法确认的回车立即搜索当前文本。 */
	onSearch?: (value: string) => void;
	/** 防抖延迟，默认 300ms */
	delay?: number;
	/** 是否显示加载中 spinner（覆盖清除按钮） */
	loading?: boolean;
	/** 尺寸，default 对应 h-9，sm 对应 h-8 */
	size?: "default" | "sm";
	/** 清除回调（点击 × 时额外触发，onSearch("") 仍会调用） */
	onClear?: () => void;
}

const sizeMap = {
	default: "h-9 text-sm pl-9 pr-9",
	sm: "h-8 text-xs pl-7 pr-8",
};

const iconSizeMap = {
	default: "size-4",
	sm: "size-3.5",
};

/** 调用方的 onKeyDown 先执行，preventDefault 可取消内部的回车搜索。 */
export function SearchInput({
	value,
	defaultValue = "",
	onValueChange,
	onSearch,
	delay = 300,
	loading = false,
	size = "default",
	onClear,
	className,
	placeholder,
	onKeyDown,
	disabled,
	readOnly,
	ref,
	...rest
}: SearchInputProps) {
	const reactId = useId();
	const [inner, setInner] = useState(defaultValue);
	const isControlled = value !== undefined;
	const currentValue = value ?? inner;
	const inputRef = useRef<HTMLInputElement>(null);
	const attachRef = useCallback(
		(node: HTMLInputElement | null) => {
			inputRef.current = node;
			if (typeof ref === "function") {
				const cleanup = ref(node);
				if (typeof cleanup === "function") {
					return () => {
						inputRef.current = null;
						cleanup();
					};
				}
			} else if (ref) {
				ref.current = node;
			}
		},
		[ref],
	);

	const debounced = useDebouncedCallback(
		(v: string) => {
			onSearch?.(v);
		},
		{ delay },
	);

	const update = useCallback(
		(next: string) => {
			if (!isControlled) setInner(next);
			onValueChange?.(next);
			if (onSearch) debounced.run(next);
		},
		[isControlled, onValueChange, onSearch, debounced],
	);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (disabled || readOnly) return;
		update(e.target.value);
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		onKeyDown?.(e);
		if (
			e.defaultPrevented ||
			disabled ||
			!onSearch ||
			e.key !== "Enter" ||
			e.nativeEvent.isComposing ||
			e.nativeEvent.keyCode === 229
		)
			return;
		e.preventDefault();
		debounced.run(e.currentTarget.value);
		debounced.flush();
	};

	const handleClear = () => {
		if (disabled || readOnly) return;
		debounced.cancel();
		if (!isControlled) setInner("");
		onValueChange?.("");
		onSearch?.("");
		onClear?.();
		inputRef.current?.focus();
	};

	const showClear = !loading && currentValue.length > 0;

	return (
		<div
			role="search"
			className={cn(
				"relative flex items-center",
				size === "sm" ? "text-xs" : "text-sm",
				className,
			)}
		>
			<Search
				className={cn(
					"pointer-events-none absolute left-2.5 text-muted-foreground",
					iconSizeMap[size],
				)}
				aria-hidden="true"
			/>
			<input
				{...rest}
				ref={attachRef}
				id={rest.id ?? `search-${reactId}`}
				type="text"
				value={currentValue}
				onChange={handleChange}
				onKeyDown={handleKeyDown}
				disabled={disabled}
				readOnly={readOnly}
				placeholder={placeholder ?? "搜索…"}
				className={cn(
					"w-full rounded-md border border-input bg-background text-foreground",
					"ring-offset-background placeholder:text-muted-foreground",
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					"disabled:cursor-not-allowed disabled:opacity-50",
					sizeMap[size],
				)}
			/>
			{loading ? (
				<Loader2
					className={cn(
						"absolute right-2.5 animate-spin text-muted-foreground motion-reduce:animate-none",
						iconSizeMap[size],
					)}
					aria-hidden="true"
				/>
			) : showClear ? (
				<button
					type="button"
					onClick={handleClear}
					className={cn(
						"absolute right-2 flex items-center justify-center rounded-full",
						"text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
						"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
						"disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
						size === "sm" ? "size-5" : "size-6",
					)}
					aria-label="清除搜索"
					disabled={disabled || readOnly}
				>
					<X aria-hidden="true" className={size === "sm" ? "size-3" : "size-3.5"} />
				</button>
			) : null}
		</div>
	);
}
