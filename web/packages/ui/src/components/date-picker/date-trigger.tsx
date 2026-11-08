"use client";

import { cn } from "cn";
import { CalendarDays, Clock, X } from "lucide-react";
import { inputVariants } from "../input/styles";
import type { DateTriggerProps } from "./types";

export function DateTrigger({
	inputProps,
	endInputProps,
	anchorRef,
	variant,
	controlSize,
	classNames,
	invalid,
	valid,
	clearable,
	clearLabel = "清除",
	onClear,
	onOpen,
	mode,
	hasValue,
}: DateTriggerProps) {
	const { disabled, readOnly } = inputProps;
	const classes = inputVariants({ variant, controlSize });
	return (
		<div
			ref={anchorRef}
			className={cn(classes, "v-date-picker", classNames?.control)}
			data-disabled={disabled || undefined}
			data-readonly={readOnly || undefined}
			data-invalid={invalid || undefined}
			data-valid={(valid && !invalid) || undefined}
		>
			<input
				{...inputProps}
				type="text"
				className={cn(
					"v-input",
					"v-date-picker__input",
					classNames?.input,
					inputProps.className,
				)}
			/>
			{endInputProps && (
				<>
					<span className="v-date-picker__to" aria-hidden>
						至
					</span>
					<input
						{...endInputProps}
						type="text"
						className={cn(
							"v-input",
							"v-date-picker__input",
							classNames?.input,
							endInputProps.className,
						)}
					/>
				</>
			)}
			{clearable && hasValue && !disabled && !readOnly && !inputProps.required && (
				<button
					type="button"
					className={cn("v-input-control__action", classNames?.action)}
					aria-label={clearLabel}
					onMouseDown={(event) => event.preventDefault()}
					onClick={(event) => {
						event.stopPropagation();
						onClear();
					}}
				>
					<X aria-hidden />
				</button>
			)}
			{!readOnly && (
				<button
					type="button"
					className={cn(
						"v-input-control__action",
						"v-date-picker__icon",
						classNames?.action,
					)}
					aria-label={mode === "time" ? "打开时间选择" : "打开日期选择"}
					disabled={disabled}
					onMouseDown={(event) => event.preventDefault()}
					onClick={(event) => {
						event.currentTarget.parentElement?.querySelector("input")?.focus();
						onOpen();
					}}
				>
					{mode === "time" ? <Clock aria-hidden /> : <CalendarDays aria-hidden />}
				</button>
			)}
		</div>
	);
}
