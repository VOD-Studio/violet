"use client";

import { Loader2, Search, X } from "lucide-react";
import { type ComponentProps, useCallback, useId, useRef, useState } from "react";
import { useDebouncedCallback } from "../../lib/use-debounced-callback";
import { Input } from "./input";

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
	/** 尺寸,default 为 36px,sm 为 32px */
	size?: "default" | "sm";
	/** 清除回调（点击 × 时额外触发，onSearch("") 仍会调用） */
	onClear?: () => void;
}

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
		<div role="search" className={className}>
			<Input
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
				variant="outline"
				leading={<Search aria-hidden="true" />}
				trailing={
					loading ? (
						<Loader2 aria-hidden="true" className="v-input-control__search-loading" />
					) : showClear ? (
						<button
							type="button"
							onClick={handleClear}
							className="v-input-control__search-action"
							aria-label="清除搜索"
							disabled={disabled || readOnly}
						>
							<X aria-hidden="true" />
						</button>
					) : undefined
				}
				classNames={{
					control:
						size === "sm" ? "v-input-control--search-sm" : "v-input-control--search",
				}}
			/>
		</div>
	);
}
