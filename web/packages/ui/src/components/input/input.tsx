"use client";

import { cn } from "cn";
import { Eye, EyeOff, X } from "lucide-react";
import { useComposedRefs } from "radix-ui/internal";
import {
	type ComponentProps,
	type ReactNode,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { type InputVariantProps, inputVariants } from "./styles";

/** Input 样式槽；root/control 管理布局，input 对应原生输入节点。 */
export interface InputClassNames {
	root?: string;
	control?: string;
	input?: string;
	label?: string;
	description?: string;
	error?: string;
	leading?: string;
	trailing?: string;
	action?: string;
}

/** 原生 input 属性与事件保持原义；className、style、ref 均属于 input。 */
export interface InputProps extends ComponentProps<"input">, InputVariantProps {
	leading?: ReactNode;
	trailing?: ReactNode;
	clearable?: boolean;
	clearLabel?: string;
	/** 仅在 type="password" 时提供显隐按钮。 */
	passwordToggle?: boolean;
	showPasswordLabel?: string;
	hidePasswordLabel?: string;
	label?: ReactNode;
	description?: ReactNode;
	/** 仅在 invalid 状态显示并关联到 input。 */
	errorMessage?: ReactNode;
	/** 显式值优先于 aria-invalid。 */
	invalid?: boolean;
	classNames?: InputClassNames;
}

function hasContent(node: ReactNode) {
	return node != null && typeof node !== "boolean";
}

/** 带可选标签、说明及辅助操作的原生输入控件。 */
export function Input({
	ref,
	className,
	classNames,
	variant,
	controlSize,
	leading,
	trailing,
	clearable = false,
	clearLabel = "清除输入",
	passwordToggle = false,
	showPasswordLabel = "显示密码",
	hidePasswordLabel = "隐藏密码",
	label,
	description,
	errorMessage,
	invalid,
	id,
	type,
	value,
	defaultValue,
	disabled,
	readOnly,
	onChange,
	"aria-describedby": describedBy,
	"aria-invalid": ariaInvalid,
	...props
}: InputProps) {
	const generatedId = useId();
	const inputId = id ?? generatedId;
	const descriptionId = `${inputId}-description`;
	const errorId = `${inputId}-error`;
	const inputRef = useRef<HTMLInputElement>(null);
	const composedRef = useComposedRefs(ref, inputRef);
	const [hasValue, setHasValue] = useState(() => String(value ?? defaultValue ?? "") !== "");
	const [passwordVisible, setPasswordVisible] = useState(false);
	const isInvalid =
		invalid ??
		(ariaInvalid === true ||
			ariaInvalid === "true" ||
			ariaInvalid === "grammar" ||
			ariaInvalid === "spelling");
	const hasDescription = hasContent(description);
	const hasError = isInvalid && hasContent(errorMessage);
	const descriptionIds = [
		...(describedBy?.split(/\s+/).filter(Boolean) ?? []),
		...(hasDescription ? [descriptionId] : []),
		...(hasError ? [errorId] : []),
	];
	const accessibleDescription = [...new Set(descriptionIds)].join(" ") || undefined;
	const canClear =
		clearable && !disabled && !readOnly && (value == null ? hasValue : String(value) !== "");
	const canTogglePassword = passwordToggle && type === "password";

	useLayoutEffect(() => {
		if (clearable && inputRef.current) setHasValue(inputRef.current.value !== "");
	});

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
	};

	return (
		<div
			data-slot="input-field"
			data-invalid={isInvalid ? "true" : undefined}
			data-disabled={disabled ? "true" : undefined}
			className={cn("v-input-field", classNames?.root)}
		>
			{hasContent(label) && (
				<label htmlFor={inputId} className={cn("v-input-field__label", classNames?.label)}>
					{label}
				</label>
			)}
			<div
				data-slot="input-control"
				className={inputVariants({ variant, controlSize, className: classNames?.control })}
			>
				{hasContent(leading) && (
					<span className={cn("v-input-control__leading", classNames?.leading)}>
						{leading}
					</span>
				)}
				<input
					{...props}
					ref={composedRef}
					id={inputId}
					type={canTogglePassword && passwordVisible ? "text" : type}
					value={value}
					defaultValue={defaultValue}
					disabled={disabled}
					readOnly={readOnly}
					aria-invalid={invalid === undefined ? ariaInvalid : invalid}
					aria-describedby={accessibleDescription}
					data-slot="input"
					className={cn("v-input", classNames?.input, className)}
					onChange={(event) => {
						if (clearable) setHasValue(event.currentTarget.value !== "");
						onChange?.(event);
					}}
				/>
				{hasContent(trailing) && (
					<span className={cn("v-input-control__trailing", classNames?.trailing)}>
						{trailing}
					</span>
				)}
				{canClear && (
					<button
						type="button"
						className={cn("v-input-control__action", classNames?.action)}
						aria-label={clearLabel}
						onClick={clear}
					>
						<X aria-hidden="true" />
					</button>
				)}
				{canTogglePassword && (
					<button
						type="button"
						className={cn("v-input-control__action", classNames?.action)}
						disabled={disabled || readOnly}
						aria-label={passwordVisible ? hidePasswordLabel : showPasswordLabel}
						aria-pressed={passwordVisible}
						onClick={() => {
							inputRef.current?.focus({ preventScroll: true });
							setPasswordVisible((visible) => !visible);
						}}
					>
						{passwordVisible ? (
							<EyeOff aria-hidden="true" />
						) : (
							<Eye aria-hidden="true" />
						)}
					</button>
				)}
			</div>
			{hasDescription && (
				<p
					id={descriptionId}
					data-slot="description"
					className={cn("v-input-field__description", classNames?.description)}
				>
					{description}
				</p>
			)}
			{hasError && (
				<p
					id={errorId}
					data-slot="error"
					className={cn("v-input-field__error", classNames?.error)}
				>
					{errorMessage}
				</p>
			)}
		</div>
	);
}
