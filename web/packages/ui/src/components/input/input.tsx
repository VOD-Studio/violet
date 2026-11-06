"use client";

import { cn } from "cn";
import { Check, CircleAlert, CircleCheck, Copy, Eye, EyeOff, X } from "lucide-react";
import { useComposedRefs } from "radix-ui/internal";
import {
	type ComponentProps,
	type MouseEvent,
	type ReactNode,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { Spinner } from "../indicator";
import { type InputVariantProps, inputVariants } from "./styles";

/** 复制成功后图标保持「已复制」的时长。 */
const COPIED_MS = 1500;

/** Input 样式槽；`control` 是外壳，`input` 对应原生输入节点，`action` 同时作用于清除、显隐、复制三种圆钮。 */
export interface InputClassNames {
	control?: string;
	input?: string;
	leading?: string;
	trailing?: string;
	action?: string;
}

/**
 * 原生 input 属性与事件保持原义；`className`、`style`、`ref`、`id`、`name` 均属于 input。
 *
 * @remarks 输入框没有可见标签，也不渲染提示、错误或字数：这些属于表单项。单独使用时必须给
 * `aria-label`；`aria-describedby`、`aria-invalid` 等由表单项传入，原样落在 input。
 */
export interface InputProps extends ComponentProps<"input">, InputVariantProps {
	/** 前置槽：图标（按尺寸自动 16 / 20）或一小段文字，不可点。 */
	leading?: ReactNode;
	/** 后置槽：单位、键帽、域名等，不可点。 */
	trailing?: ReactNode;
	/** 有内容且可编辑时提供清除钮；输入区按 Esc 同样清空，已空时不拦截 Esc。 */
	clearable?: boolean;
	/** 清除钮的可访问名称，默认「清除」。 */
	clearLabel?: string;
	/** 清除后触发，晚于派发的原生 input 事件。 */
	onClear?: () => void;
	/** 仅在 `type="password"` 时提供显隐钮；切换前后光标位置保持。 */
	passwordToggle?: boolean;
	/** 显隐钮的可访问名称，默认「显示密码」；状态由 `aria-pressed` 表达，名称不随状态变化。 */
	passwordToggleLabel?: string;
	/** 提供复制钮，复制输入区当前值；通常配合 `readOnly`，输入区改用等宽字体。 */
	copyable?: boolean;
	/** 复制钮的可访问名称，默认「复制」。 */
	copyLabel?: string;
	/** 剪贴板写入成功后触发。剪贴板不可用时静默失败，不触发。 */
	onCopied?: (value: string) => void;
	/** 出错外观；显式值优先于 `aria-invalid`，并同步写入 `aria-invalid`。 */
	invalid?: boolean;
	/** 通过外观（成功色）。只是视觉反馈，不写任何 ARIA 属性；出错优先于通过。 */
	valid?: boolean;
	/** 加载中：状态位显示细圆弧，并设 `aria-busy`。 */
	loading?: boolean;
	classNames?: InputClassNames;
}

function hasContent(node: ReactNode) {
	return node != null && typeof node !== "boolean";
}

function isText(node: ReactNode) {
	return typeof node === "string" || typeof node === "number";
}

/** 带前后置槽、清除、显隐与复制辅助操作的原生输入控件。 */
export function Input({
	ref,
	className,
	classNames,
	variant,
	controlSize,
	leading,
	trailing,
	loading = false,
	clearable = false,
	clearLabel = "清除",
	onClear,
	passwordToggle = false,
	passwordToggleLabel = "显示密码",
	copyable = false,
	copyLabel = "复制",
	onCopied,
	invalid,
	valid = false,
	id,
	type,
	value,
	defaultValue,
	disabled,
	readOnly,
	onChange,
	onKeyDown,
	"aria-invalid": ariaInvalid,
	...props
}: InputProps) {
	const generatedId = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const composedRef = useComposedRefs(ref, inputRef);
	const [hasValue, setHasValue] = useState(() => String(value ?? defaultValue ?? "") !== "");
	const [passwordVisible, setPasswordVisible] = useState(false);
	const [copied, setCopied] = useState(false);
	const pendingSelection = useRef<{
		start: number | null;
		end: number | null;
		direction: "forward" | "backward" | "none" | null;
	} | null>(null);
	const copyTimer = useRef<number | undefined>(undefined);
	const isInvalid =
		invalid ??
		(ariaInvalid === true ||
			ariaInvalid === "true" ||
			ariaInvalid === "grammar" ||
			ariaInvalid === "spelling");
	const isValid = valid && !isInvalid;
	const status = loading ? "loading" : isInvalid ? "invalid" : isValid ? "valid" : undefined;
	const canClear =
		clearable && !disabled && !readOnly && (value == null ? hasValue : String(value) !== "");
	const canTogglePassword = passwordToggle && type === "password";

	useLayoutEffect(() => {
		if (clearable && inputRef.current) setHasValue(inputRef.current.value !== "");
	});

	// 切换 type 会让部分浏览器把光标重置到末尾：在提交后还原，并保持焦点在输入区。
	// biome-ignore lint/correctness/useExhaustiveDependencies: 仅在显隐切换后执行
	useLayoutEffect(() => {
		const input = inputRef.current;
		const selection = pendingSelection.current;
		pendingSelection.current = null;
		if (!input || !selection) return;
		input.focus({ preventScroll: true });
		if (selection.start != null && selection.end != null) {
			input.setSelectionRange(
				selection.start,
				selection.end,
				selection.direction ?? undefined,
			);
		}
	}, [passwordVisible]);

	useEffect(() => () => clearTimeout(copyTimer.current), []);

	useEffect(() => {
		const input = inputRef.current;
		if (!clearable || !input) return;
		const scopes = new Set<EventTarget>([input.ownerDocument, input.getRootNode()]);
		const pendingResets = new WeakSet<Event>();
		let active = true;
		const captureReset = (event: Event) => {
			const owner = input.form;
			if (!owner || event.target !== owner || pendingResets.has(event)) return;
			pendingResets.add(event);
			const finishReset = () => {
				// 原生 reset 按钮可能在默认动作之前执行事件中的微任务。
				if (active && event.eventPhase !== Event.NONE) {
					setTimeout(finishReset, 0);
					return;
				}
				pendingResets.delete(event);
				if (active && !event.defaultPrevented && input.form === owner) {
					setHasValue(input.value !== "");
				}
			};
			queueMicrotask(finishReset);
		};
		for (const scope of scopes) scope.addEventListener("reset", captureReset, true);
		return () => {
			active = false;
			for (const scope of scopes) scope.removeEventListener("reset", captureReset, true);
		};
	}, [clearable]);

	const clear = () => {
		const input = inputRef.current;
		if (!input || input.disabled || input.readOnly) return;
		// 在按钮可能卸载之前恢复 input 焦点，保持整个控件的 focus-within。
		input.focus({ preventScroll: true });
		const view = input.ownerDocument.defaultView;
		if (!view) return;
		const setter = Object.getOwnPropertyDescriptor(
			view.HTMLInputElement.prototype,
			"value",
		)?.set;
		setter?.call(input, "");
		input.dispatchEvent(new view.Event("input", { bubbles: true, composed: true }));
		setHasValue(input.value !== "");
		onClear?.();
	};

	const togglePassword = () => {
		const input = inputRef.current;
		if (input) {
			input.focus({ preventScroll: true });
			pendingSelection.current = {
				start: input.selectionStart,
				end: input.selectionEnd,
				direction: input.selectionDirection,
			};
		}
		setPasswordVisible((visible) => !visible);
	};

	const copy = () => {
		const input = inputRef.current;
		const clipboard = input?.ownerDocument.defaultView?.navigator.clipboard;
		if (!input || !clipboard) return;
		const text = input.value;
		void Promise.resolve()
			.then(() => clipboard.writeText(text))
			.then(
				() => {
					onCopied?.(text);
					setCopied(true);
					clearTimeout(copyTimer.current);
					copyTimer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
				},
				() => {},
			);
	};

	// 点外壳的空白处（内边距、前后置槽）也聚焦输入区，且不让焦点先离开再回来。
	const focusFromShell = (event: MouseEvent<HTMLDivElement>) => {
		if (event.button !== 0 || disabled) return;
		if ((event.target as Element).closest("button, input")) return;
		event.preventDefault();
		inputRef.current?.focus();
	};

	return (
		<div
			data-slot="input-control"
			data-invalid={isInvalid ? "" : undefined}
			data-valid={isValid ? "" : undefined}
			data-disabled={disabled ? "" : undefined}
			data-readonly={readOnly ? "" : undefined}
			data-copyable={copyable ? "" : undefined}
			className={inputVariants({ variant, controlSize, className: classNames?.control })}
			onMouseDown={focusFromShell}
		>
			{hasContent(leading) && (
				<span
					className={cn("v-input-control__leading", classNames?.leading)}
					data-text={isText(leading) ? "" : undefined}
				>
					{leading}
				</span>
			)}
			<input
				{...props}
				ref={composedRef}
				id={id ?? generatedId}
				type={canTogglePassword && passwordVisible ? "text" : type}
				value={value}
				defaultValue={defaultValue}
				disabled={disabled}
				readOnly={readOnly}
				aria-invalid={invalid === undefined ? ariaInvalid : invalid}
				aria-busy={loading || props["aria-busy"]}
				data-slot="input"
				className={cn("v-input", classNames?.input, className)}
				onChange={(event) => {
					if (clearable) setHasValue(event.currentTarget.value !== "");
					onChange?.(event);
				}}
				onKeyDown={(event) => {
					onKeyDown?.(event);
					if (
						event.defaultPrevented ||
						event.key !== "Escape" ||
						event.nativeEvent.isComposing ||
						!canClear ||
						event.currentTarget.value === ""
					) {
						return;
					}
					event.preventDefault();
					clear();
				}}
			/>
			{canClear && (
				<button
					type="button"
					className={cn(
						"v-input-control__action v-input-control__action--clear",
						classNames?.action,
					)}
					aria-label={clearLabel}
					onClick={clear}
				>
					<X aria-hidden="true" />
				</button>
			)}
			{status && (
				<span className="v-input-control__status" data-status={status}>
					{status === "loading" ? (
						<Spinner size={16} aria-hidden="true" />
					) : status === "invalid" ? (
						<CircleAlert aria-hidden="true" />
					) : (
						<CircleCheck aria-hidden="true" />
					)}
				</span>
			)}
			{hasContent(trailing) && (
				<span
					className={cn("v-input-control__trailing", classNames?.trailing)}
					data-text={isText(trailing) ? "" : undefined}
				>
					{trailing}
				</span>
			)}
			{canTogglePassword && (
				<button
					type="button"
					className={cn("v-input-control__action", classNames?.action)}
					disabled={disabled || readOnly}
					aria-label={passwordToggleLabel}
					aria-pressed={passwordVisible}
					onClick={togglePassword}
				>
					{passwordVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
				</button>
			)}
			{copyable && (
				<button
					type="button"
					className={cn("v-input-control__action", classNames?.action)}
					data-copied={copied ? "" : undefined}
					disabled={disabled}
					aria-label={copyLabel}
					onClick={copy}
				>
					{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
				</button>
			)}
		</div>
	);
}
