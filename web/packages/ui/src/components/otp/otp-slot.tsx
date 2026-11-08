"use client";

import { cn } from "cn";
import { useImperativeHandle, useRef } from "react";
import { useOTPContext } from "./context";
import type { InputOTPSlotProps } from "./types";
import { digits } from "./use-otp";

/** 一格真实 input，完整验证码的粘贴和短信建议由根拆到各格。 */
export function InputOTPSlot({
	index,
	ref,
	className,
	onChange,
	onKeyDown,
	onPaste,
	onFocus,
	disabled: slotDisabled,
	readOnly: slotReadOnly,
	...props
}: InputOTPSlotProps) {
	const context = useOTPContext();
	const inputRef = useRef<HTMLInputElement>(null);
	const native =
		index === 0 || !context.nativeProps.autoFocus
			? context.nativeProps
			: { ...context.nativeProps, autoFocus: false };
	const disabled = context.disabled || slotDisabled;
	const readOnly = context.readOnly || slotReadOnly || context.errorActive;
	useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);
	if (index < 0 || index >= context.length) return null;

	return (
		<span
			className="v-otp__cell"
			data-break={index === 2 && context.length > 3 ? "" : undefined}
			data-disabled={disabled || undefined}
			data-readonly={readOnly || undefined}
		>
			<input
				{...native}
				{...props}
				ref={(input) => {
					inputRef.current = input;
					context.inputs.current[index] = input;
				}}
				id={props.id ?? (index === 0 ? context.id : `${context.id}-${index + 1}`)}
				form={props.form ?? context.form}
				type="text"
				className={cn("v-otp__input", className)}
				data-slot="input-otp-slot"
				aria-label={props["aria-label"] ?? `第 ${index + 1} 位`}
				aria-describedby={props["aria-describedby"] ?? context.describedBy}
				aria-invalid={props["aria-invalid"] ?? context.invalid}
				inputMode={props.inputMode ?? native.inputMode ?? "numeric"}
				autoComplete={props.autoComplete ?? native.autoComplete ?? "one-time-code"}
				pattern={props.pattern ?? native.pattern ?? "[0-9]*"}
				maxLength={context.length}
				disabled={disabled}
				readOnly={readOnly}
				value={context.cells[index] ?? ""}
				onFocus={(event) => {
					native.onFocus?.(event);
					onFocus?.(event);
					if (!event.defaultPrevented) event.currentTarget.select();
				}}
				onChange={(event) => {
					onChange?.(event);
					if (event.defaultPrevented || disabled || readOnly) {
						event.currentTarget.value = context.cells[index] ?? "";
						return;
					}
					const inserted = (event.nativeEvent as InputEvent).data;
					const text = digits(inserted ?? event.currentTarget.value, context.length);
					if (text) context.put(index, text, text.length >= context.length);
					else {
						if (!event.currentTarget.value) context.erase(index);
						event.currentTarget.value = context.cells[index] ?? "";
					}
				}}
				onPaste={(event) => {
					native.onPaste?.(event);
					onPaste?.(event);
					if (event.defaultPrevented || disabled || readOnly) return;
					const text = digits(event.clipboardData.getData("text"), context.length);
					if (!text) return;
					event.preventDefault();
					context.put(index, text, text.length >= context.length);
				}}
				onKeyDown={(event) => {
					native.onKeyDown?.(event);
					onKeyDown?.(event);
					if (event.defaultPrevented || disabled) return;
					if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
						event.preventDefault();
						const next = index + (event.key === "ArrowLeft" ? -1 : 1);
						context.focus(Math.max(0, Math.min(context.length - 1, next)));
					} else if (!readOnly && (event.key === "Backspace" || event.key === "Delete")) {
						event.preventDefault();
						context.erase(index, event.key === "Backspace");
					}
				}}
			/>
		</span>
	);
}
