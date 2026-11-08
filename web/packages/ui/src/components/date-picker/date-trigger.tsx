"use client";

import { cn } from "cn";
import { CalendarDays, Clock, X } from "lucide-react";
import { useComposedRefs } from "radix-ui/internal";
import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";
import { inputVariants } from "../input/styles";
import type { DateTriggerProps } from "./types";

/** 范围两端之间的区间符号：一条细线两端各一道短竖，像尺寸标注，只表示「从这里到那里」，不带方向。 */
function RangeIcon() {
	return (
		<svg className="v-date-picker__to" viewBox="0 0 24 24" aria-hidden="true">
			<title>至</title>
			<path d="M3 12h18M3 7v10M21 7v10" />
		</svg>
	);
}

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
	endpoint = "start",
	open,
}: DateTriggerProps) {
	const { disabled, readOnly } = inputProps;
	const classes = inputVariants({ variant, controlSize });
	const shell = useRef<HTMLDivElement>(null);
	const composedRef = useComposedRefs(anchorRef, shell);
	const isRange = !!endInputProps;
	const [bar, setBar] = useState<{ x: number; width: number } | null>(null);
	useLayoutEffect(() => {
		const node = shell.current;
		if (!isRange || !node) return;
		const inputs = node.querySelectorAll<HTMLInputElement>("input.v-date-picker__input");
		const measure = () => {
			const target = inputs[endpoint === "end" ? 1 : 0];
			if (!target) return;
			const next = { x: target.offsetLeft, width: target.offsetWidth };
			setBar((current) =>
				current && current.x === next.x && current.width === next.width ? current : next,
			);
		};
		measure();
		if (typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(measure);
		observer.observe(node);
		for (const input of inputs) observer.observe(input);
		return () => observer.disconnect();
	}, [endpoint, isRange]);
	const canClear = clearable && hasValue && !disabled && !readOnly && !inputProps.required;
	return (
		<div
			ref={composedRef}
			className={cn(classes, "v-date-picker", classNames?.control)}
			data-disabled={disabled || undefined}
			data-readonly={readOnly || undefined}
			data-invalid={invalid || undefined}
			data-valid={(valid && !invalid) || undefined}
			data-range={isRange || undefined}
			data-mode={mode}
			data-endpoint={isRange ? endpoint : undefined}
			data-open={open || undefined}
			onMouseDown={(event) => {
				const target = event.target as HTMLElement;
				if (disabled || readOnly || event.button !== 0 || target.closest("input, button"))
					return;
				event.preventDefault();
				const inputs = event.currentTarget.querySelectorAll<HTMLInputElement>(
					"input.v-date-picker__input",
				);
				const arrow = event.currentTarget.querySelector(".v-date-picker__to");
				const middle = arrow
					? arrow.getBoundingClientRect().left + arrow.getBoundingClientRect().width / 2
					: Number.POSITIVE_INFINITY;
				(inputs[1] && event.clientX > middle ? inputs[1] : inputs[0])?.focus();
				onOpen();
			}}
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
					<RangeIcon />
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
			{isRange && bar && (
				<span
					className="v-date-picker__indicator"
					aria-hidden
					style={
						{
							"--v-date-picker-bar-x": `${bar.x}px`,
							"--v-date-picker-bar-w": `${bar.width}px`,
						} as CSSProperties
					}
				/>
			)}
			{(canClear || !readOnly) && (
				<span className="v-date-picker__tail">
					{canClear && (
						<button
							type="button"
							className={cn(
								"v-input-control__action",
								"v-input-control__action--clear",
								classNames?.action,
							)}
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
							tabIndex={-1}
							className={cn(
								"v-input-control__action",
								"v-date-picker__icon",
								classNames?.action,
							)}
							aria-label={mode === "time" ? "打开时间选择" : "打开日期选择"}
							disabled={disabled}
							onMouseDown={(event) => event.preventDefault()}
							onClick={(event) => {
								event.currentTarget
									.closest(".v-date-picker")
									?.querySelector("input")
									?.focus();
								onOpen();
							}}
						>
							{mode === "time" ? <Clock aria-hidden /> : <CalendarDays aria-hidden />}
						</button>
					)}
				</span>
			)}
		</div>
	);
}
