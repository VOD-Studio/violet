"use client";

import { cn } from "cn";
import { useComposedRefs } from "radix-ui/internal";
import {
	type ComponentProps,
	type MouseEvent,
	type ReactNode,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { type TextareaVariantProps, textareaVariants } from "./styles";

/** 与 textarea.css 的 `line-height: 1.5rem` 保持同步：自动增高按行数换算像素。 */
const LINE_HEIGHT = 24;

const DEFAULT_AUTO_SIZE = { minRows: 3, maxRows: 8 };

/** 自动增高的行数范围；超出 `maxRows` 后在输入区内部滚动。 */
export interface TextareaAutoSize {
	/** 最少行数，默认 3。 */
	minRows?: number;
	/** 最多行数，默认 8。 */
	maxRows?: number;
}

/** Textarea 样式槽；`control` 是外壳，`input` 对应原生输入区，`count` 与 `bar` 作用于字数与操作栏。 */
export interface TextareaClassNames {
	control?: string;
	input?: string;
	count?: string;
	bar?: string;
}

/**
 * 原生 textarea 属性与事件保持原义；`className`、`style`、`ref`、`id`、`name` 均属于输入区。
 *
 * @remarks 标签、提示与错误文案不属于多行输入，交给表单项；单独使用时必须给 `aria-label`。
 * 字数 `n / max` 需要同时给 `showCount` 与 `maxLength`；达到上限 90% 变危险色，读稿从这时开始。
 * Enter 始终换行，需要「回车发送」的场景由调用方在 `onKeyDown` 里处理 ⌘↵ 并在 `toolbar` 写出。
 */
export interface TextareaProps extends ComponentProps<"textarea">, TextareaVariantProps {
	/** 自动增高：高度跟随内容在 `minRows`–`maxRows` 之间生长，设置后忽略原生 `rows`。 */
	autoSize?: boolean | TextareaAutoSize;
	/** 在外壳右下角显示字数 `n / max`；需要 `maxLength`，没有时不渲染。 */
	showCount?: boolean;
	/** 外壳底部的操作栏：图标钮、发送提示等；开启 `showCount` 时字数自动排到栏右端。 */
	toolbar?: ReactNode;
	/** 出错外观；显式值优先于 `aria-invalid`，并同步写入 `aria-invalid`。 */
	invalid?: boolean;
	classNames?: TextareaClassNames;
}

/**
 * 与 Input 同一外壳的多行文本控件：四种变体、聚焦与出错画法完全一致，高度由行数决定，
 * 不显示拖拽柄，增高也不做过渡。
 */
export function Textarea({
	ref,
	className,
	classNames,
	variant,
	autoSize = false,
	showCount = false,
	toolbar,
	invalid,
	id,
	value,
	defaultValue,
	maxLength,
	disabled,
	readOnly,
	onChange,
	"aria-invalid": ariaInvalid,
	...props
}: TextareaProps) {
	const generatedId = useId();
	const fieldRef = useRef<HTMLTextAreaElement>(null);
	const composedRef = useComposedRefs(ref, fieldRef);
	const [length, setLength] = useState(() => String(value ?? defaultValue ?? "").length);
	const autoRange = autoSize
		? { ...DEFAULT_AUTO_SIZE, ...(autoSize === true ? null : autoSize) }
		: null;
	// 挂载一次的原生监听经 ref 读取最新行数范围，消费方传字面量对象时不重复挂载
	const autoRangeRef = useRef(autoRange);
	autoRangeRef.current = autoRange;
	const isInvalid =
		invalid ??
		(ariaInvalid === true ||
			ariaInvalid === "true" ||
			ariaInvalid === "grammar" ||
			ariaInvalid === "spelling");
	const countable = showCount && typeof maxLength === "number";
	const nearLimit = countable && length >= maxLength * 0.9;

	useLayoutEffect(() => {
		if (countable && fieldRef.current) setLength(fieldRef.current.value.length);
	});

	useLayoutEffect(() => {
		if (!autoRange) return;
		const field = fieldRef.current;
		if (!field) return;
		const grow = () => {
			const { minRows, maxRows } = autoRangeRef.current ?? DEFAULT_AUTO_SIZE;
			const el = fieldRef.current;
			if (!el) return;
			el.style.height = "0px";
			const content = el.scrollHeight;
			el.style.height = `${Math.min(maxRows, Math.max(minRows, content / LINE_HEIGHT)) * LINE_HEIGHT}px`;
		};
		grow();
		const onInput = () => {
			if (countable) setLength(fieldRef.current?.value.length ?? 0);
			grow();
		};
		const onResize = () => grow();
		field.addEventListener("input", onInput);
		field.ownerDocument.defaultView?.addEventListener("resize", onResize);
		return () => {
			field.removeEventListener("input", onInput);
			field.ownerDocument.defaultView?.removeEventListener("resize", onResize);
		};
	}, [autoRange, countable]);

	// 点外壳的空白处（内边距、操作栏两侧）也聚焦输入区，按钮照常点击。
	const focusFromShell = (event: MouseEvent<HTMLDivElement>) => {
		if (event.button !== 0 || disabled) return;
		if ((event.target as Element).closest("button, textarea")) return;
		event.preventDefault();
		fieldRef.current?.focus();
	};

	const count = countable ? (
		<>
			<span
				className={cn("v-textarea__count", classNames?.count)}
				data-over={nearLimit ? "" : undefined}
				aria-hidden="true"
			>
				{`${length} / ${maxLength}`}
			</span>
			{/* 读稿只在接近上限时开始：阈值之前保持空，进入阈值后的每次更新都会播报 */}
			<span className="v-textarea-sr" aria-live="polite">
				{nearLimit ? `${length} / ${maxLength}` : ""}
			</span>
		</>
	) : null;

	return (
		<div
			data-slot="textarea-control"
			data-invalid={isInvalid ? "" : undefined}
			data-disabled={disabled ? "" : undefined}
			data-readonly={readOnly ? "" : undefined}
			data-count={countable ? "" : undefined}
			className={textareaVariants({ variant, className: classNames?.control })}
			onMouseDown={focusFromShell}
		>
			<textarea
				{...props}
				maxLength={maxLength}
				ref={composedRef}
				id={id ?? generatedId}
				value={value}
				defaultValue={defaultValue}
				disabled={disabled}
				readOnly={readOnly}
				aria-invalid={invalid === undefined ? ariaInvalid : invalid}
				data-slot="textarea-field"
				className={cn("v-input v-textarea__field", classNames?.input, className)}
				onChange={(event) => {
					if (countable) setLength(event.currentTarget.value.length);
					onChange?.(event);
				}}
			/>
			{toolbar ? (
				<div className={cn("v-textarea__bar", classNames?.bar)}>
					{toolbar}
					{count}
				</div>
			) : (
				count
			)}
		</div>
	);
}
