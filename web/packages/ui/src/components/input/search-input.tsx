"use client";

import { Search } from "lucide-react";
import { useCallback, useState } from "react";
import { useDebouncedCallback } from "../../lib/use-debounced-callback";
import { Kbd, type KbdKey } from "../kbd";
import { Input, type InputProps } from "./input";

/** 搜索框：沿用 Input 的变体、尺寸与样式槽，增加防抖搜索；查询请求与结果由调用方管理。 */
export interface SearchInputProps
	extends Omit<
		InputProps,
		| "value"
		| "defaultValue"
		| "onChange"
		| "type"
		| "leading"
		| "trailing"
		| "clearable"
		| "passwordToggle"
		| "passwordToggleLabel"
		| "copyable"
		| "copyLabel"
		| "onCopied"
	> {
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
	/** 清除回调（点击清除钮时额外触发，onSearch("") 仍会调用） */
	onClear?: () => void;
	/** 清除钮的可访问名称，默认「清除搜索」。 */
	clearLabel?: string;
	/** 输入区为空时在后置槽显示的快捷键；默认不显示。 */
	shortcut?: readonly KbdKey[];
}

/**
 * 带搜索图标、清除钮与防抖的 Input：`type="search"`、`inputMode="search"`。
 *
 * @remarks 调用方的 onKeyDown 先执行，preventDefault 可取消内部的回车搜索。
 */
export function SearchInput({
	value,
	defaultValue = "",
	onValueChange,
	onSearch,
	delay = 300,
	onClear,
	clearLabel = "清除搜索",
	shortcut,
	placeholder,
	onKeyDown,
	disabled,
	readOnly,
	...rest
}: SearchInputProps) {
	const [inner, setInner] = useState(defaultValue);
	const isControlled = value !== undefined;
	const currentValue = value ?? inner;

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

	// Input 的清除先派发 input 事件（排入防抖），这里取消它并立即以空文本搜索。
	const handleClear = () => {
		debounced.cancel();
		onSearch?.("");
		onClear?.();
	};

	return (
		<Input
			inputMode="search"
			{...rest}
			type="search"
			value={currentValue}
			onChange={handleChange}
			onKeyDown={handleKeyDown}
			disabled={disabled}
			readOnly={readOnly}
			placeholder={placeholder ?? "搜索…"}
			leading={<Search aria-hidden="true" />}
			trailing={
				shortcut && currentValue === "" ? (
					<Kbd keys={shortcut} aria-hidden="true" />
				) : undefined
			}
			clearable
			clearLabel={clearLabel}
			onClear={handleClear}
		/>
	);
}
