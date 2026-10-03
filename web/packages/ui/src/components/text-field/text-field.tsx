"use client";

import { cn } from "cn";
import { type ReactNode, useId } from "react";
import { Input, type InputProps } from "../input";
import { Label } from "../label";

/**
 * TextField 可定制的样式槽；root 控制外层布局，input 控制原生输入框。
 */
export interface TextFieldClassNames {
	root?: string;
	label?: string;
	input?: string;
	description?: string;
	error?: string;
}

/**
 * 带标签与关联说明的原生输入框；className 与 ref 均转交 input。
 */
export interface TextFieldProps extends Omit<InputProps, "children"> {
	label: ReactNode;
	description?: ReactNode;
	/** 仅在 invalid 为 true 时渲染，并加入 aria-describedby。 */
	errorMessage?: ReactNode;
	/** 优先于 aria-invalid；省略时从原生 aria-invalid 推导错误状态。 */
	invalid?: boolean;
	classNames?: TextFieldClassNames;
}

/**
 * 组合 Label 与 Input，生成可用于 SSR 水合的稳定关联 ID。
 */
export function TextField({
	label,
	description,
	errorMessage,
	invalid,
	classNames,
	className,
	id,
	disabled,
	"aria-describedby": describedBy,
	"aria-invalid": ariaInvalid,
	...inputProps
}: TextFieldProps) {
	const generatedId = useId();
	const inputId = id ?? generatedId;
	const descriptionId = `${inputId}-description`;
	const errorId = `${inputId}-error`;
	const isInvalid =
		invalid ??
		(ariaInvalid === true ||
			ariaInvalid === "true" ||
			ariaInvalid === "grammar" ||
			ariaInvalid === "spelling");
	const hasDescription = description != null && typeof description !== "boolean";
	const hasError = isInvalid && errorMessage != null && typeof errorMessage !== "boolean";
	const descriptionIds = [
		...(describedBy?.split(/\s+/).filter(Boolean) ?? []),
		...(hasDescription ? [descriptionId] : []),
		...(hasError ? [errorId] : []),
	];
	const accessibleDescription = [...new Set(descriptionIds)].join(" ") || undefined;

	return (
		<div
			data-slot="text-field"
			data-invalid={isInvalid ? "true" : undefined}
			data-disabled={disabled ? "true" : undefined}
			className={cn("v-text-field", classNames?.root)}
		>
			<Label htmlFor={inputId} className={cn("v-text-field__label", classNames?.label)}>
				{label}
			</Label>
			<Input
				{...inputProps}
				id={inputId}
				disabled={disabled}
				aria-invalid={invalid === undefined ? ariaInvalid : invalid}
				aria-describedby={accessibleDescription}
				className={cn("v-text-field__input", classNames?.input, className)}
			/>
			{hasDescription && (
				<p
					id={descriptionId}
					data-slot="description"
					className={cn("v-text-field__description", classNames?.description)}
				>
					{description}
				</p>
			)}
			{hasError && (
				<p
					id={errorId}
					data-slot="error"
					className={cn("v-text-field__error", classNames?.error)}
				>
					{errorMessage}
				</p>
			)}
		</div>
	);
}
