"use client";

import { cn } from "cn";
import { type ComponentProps, useId, useImperativeHandle } from "react";
import { useFieldControl } from "../field";
import { OTPContext } from "./context";
import { InputOTPSlot } from "./otp-slot";
import type { InputOTPProps } from "./types";
import { useOTP } from "./use-otp";

/** 六个独立原生输入组成的验证码；校验请求与结果说明属于调用方。 */
export function InputOTP({
	ref,
	children,
	className,
	containerClassName,
	value,
	defaultValue = "",
	onChange,
	onComplete,
	maxLength = 6,
	name,
	form,
	id: suppliedId,
	disabled = false,
	readOnly = false,
	invalid,
	valid = false,
	"aria-label": label,
	"aria-labelledby": labelledBy,
	"aria-describedby": describedBy,
	"aria-invalid": ariaInvalid,
	...nativeProps
}: InputOTPProps) {
	const field = useFieldControl();
	const generatedId = useId();
	const id = suppliedId ?? field.id ?? generatedId;
	const length = Math.max(1, Math.floor(maxLength));
	const invalidAttribute = invalid ?? ariaInvalid ?? field["aria-invalid"];
	const isInvalid =
		invalidAttribute === true ||
		invalidAttribute === "true" ||
		invalidAttribute === "grammar" ||
		invalidAttribute === "spelling";
	const description = describedBy ?? field["aria-describedby"];
	const groupLabelledBy = labelledBy ?? (label ? undefined : field["aria-labelledby"]);
	const model = useOTP({
		value,
		defaultValue,
		length,
		disabled,
		readOnly,
		invalid: isInvalid,
		onChange,
		onComplete,
	});
	useImperativeHandle(ref, () => model.inputs.current[0] as HTMLInputElement);

	return (
		<OTPContext.Provider
			value={{
				...model,
				id,
				length,
				disabled,
				readOnly,
				invalid: invalidAttribute,
				describedBy: description,
				form,
				nativeProps,
			}}
		>
			<div
				id={`${id}-group`}
				role="group"
				aria-label={label ?? (groupLabelledBy ? undefined : `${length} 位验证码`)}
				aria-labelledby={groupLabelledBy}
				aria-describedby={description}
				aria-invalid={invalidAttribute}
				aria-disabled={disabled || undefined}
				data-slot="input-otp"
				data-invalid={isInvalid || undefined}
				data-valid={valid && !isInvalid ? "" : undefined}
				data-error-active={model.errorActive || undefined}
				data-readonly={readOnly || undefined}
				data-disabled={disabled || undefined}
				className={cn("v-otp", className, containerClassName)}
			>
				{children ?? (
					<InputOTPGroup>
						{Array.from({ length }, (_, index) => (
							<InputOTPSlot key={index} index={index} />
						))}
					</InputOTPGroup>
				)}
				{name ? (
					<input
						type="hidden"
						name={name}
						form={form}
						value={model.cells.join("")}
						disabled={disabled}
					/>
				) : null}
			</div>
		</OTPContext.Provider>
	);
}

/** 自定义格子分组；组间的间距仍由 OTP 根维护。 */
export function InputOTPGroup({ className, ...props }: ComponentProps<"div">) {
	return <div {...props} data-slot="input-otp-group" className={cn("v-otp__group", className)} />;
}

export type { InputOTPProps, InputOTPSlotProps } from "./types";
export { InputOTPSlot };
