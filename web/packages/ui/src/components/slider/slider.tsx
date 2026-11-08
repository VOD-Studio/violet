"use client";

import { Slider as SliderPrimitive } from "radix-ui";
import { forwardRef, useId, useImperativeHandle, useRef } from "react";
import { useFieldControl } from "../field";
import type { SliderProps } from "./types";
import { useSlider } from "./use-slider";

/** 在连续值或刻度间调节单值与不交叉区间，ref 指向轨道根元素。 */
export const Slider = forwardRef<HTMLSpanElement, SliderProps>(function Slider(
	{
		className,
		value,
		defaultValue,
		onValueChange,
		onValueCommit,
		min = 0,
		max = 100,
		step = 1,
		marks,
		thumbLabels,
		formatValue,
		name,
		form,
		disabled,
		readOnly,
		invalid,
		onKeyDown,
		onPointerDown,
		onPointerMove,
		onPointerUp,
		onPointerCancel,
		"aria-label": label,
		"aria-labelledby": labelledBy,
		"aria-describedby": describedBy,
		"aria-invalid": ariaInvalid,
		...props
	},
	forwardedRef,
) {
	const root = useRef<HTMLSpanElement>(null);
	useImperativeHandle(forwardedRef, () => root.current as HTMLSpanElement);
	const id = useId();
	const field = useFieldControl();
	const thumbOwnsId = field.id !== undefined && (props.id === undefined || props.id === field.id);
	const resolvedLabelledBy = labelledBy ?? (label ? undefined : field["aria-labelledby"]);
	const resolvedDescribedBy =
		[
			...new Set(
				[field["aria-describedby"], describedBy].flatMap(
					(ids) => ids?.split(/\s+/).filter(Boolean) ?? [],
				),
			),
		].join(" ") || undefined;
	const slider = useSlider(
		{
			value,
			defaultValue,
			onValueChange,
			onValueCommit,
			min,
			max,
			step,
			marks,
			disabled,
			readOnly,
			form,
		},
		root,
	);
	const range = slider.values.length === 2;
	const isInvalid = invalid ?? ariaInvalid ?? field["aria-invalid"];

	return (
		<SliderPrimitive.Root
			{...props}
			id={thumbOwnsId ? undefined : props.id}
			ref={root}
			className={["v-slider", className].filter(Boolean).join(" ")}
			value={slider.values}
			min={min}
			max={max}
			step={marks?.length ? 0.0000000001 : step}
			disabled={disabled}
			data-readonly={readOnly ? "" : undefined}
			data-invalid={isInvalid && isInvalid !== "false" ? "" : undefined}
			data-marks={slider.stops.length ? "" : undefined}
			data-motion={slider.motion}
			onValueChange={slider.change}
			onKeyDown={(event) => {
				onKeyDown?.(event);
				if (!event.defaultPrevented) slider.keyDown(event);
			}}
			onPointerDown={(event) => {
				onPointerDown?.(event);
				if (!event.defaultPrevented) slider.pointerDown(event);
			}}
			onPointerMove={(event) => {
				onPointerMove?.(event);
				if (!event.defaultPrevented) slider.pointerMove(event);
			}}
			onPointerUp={(event) => {
				onPointerUp?.(event);
				if (!event.defaultPrevented) slider.pointerEnd(event);
			}}
			onPointerCancel={(event) => {
				onPointerCancel?.(event);
				if (!event.defaultPrevented) slider.pointerEnd(event);
			}}
		>
			<SliderPrimitive.Track className="v-slider__track">
				<SliderPrimitive.Range className="v-slider__range" />
				{slider.stops.map((mark) => {
					const selected =
						mark.value <= slider.values[slider.values.length - 1] &&
						(!range || mark.value >= slider.values[0]);
					return (
						<span
							key={mark.value}
							aria-hidden="true"
							className="v-slider__mark"
							data-selected={selected ? "" : undefined}
							style={{
								insetInlineStart: `${((mark.value - min) / (max - min)) * 100}%`,
							}}
						/>
					);
				})}
			</SliderPrimitive.Track>
			{slider.values.map((current, index) => {
				const thumbLabel =
					thumbLabels?.[index] ?? (range ? (index === 0 ? "起点" : "终点") : undefined);
				const labelId = `${id}-${index}-label`;
				const text =
					formatValue?.(current, index) ??
					slider.stops.find((mark) => mark.value === current)?.label ??
					String(current);
				return (
					<SliderPrimitive.Thumb
						key={index === 0 ? "start" : "end"}
						ref={(element) => {
							slider.thumbs.current[index] = element;
						}}
						className="v-slider__thumb"
						id={thumbOwnsId && index === 0 ? field.id : undefined}
						data-slider-index={index}
						data-dragging={slider.dragging === index ? "" : undefined}
						aria-label={
							resolvedLabelledBy
								? undefined
								: [label, thumbLabel].filter(Boolean).join(" ") || undefined
						}
						aria-labelledby={
							resolvedLabelledBy
								? `${resolvedLabelledBy}${thumbLabel ? ` ${labelId}` : ""}`
								: undefined
						}
						aria-describedby={resolvedDescribedBy}
						aria-invalid={isInvalid}
						aria-readonly={readOnly || undefined}
						aria-valuemin={slider.values[index - 1] ?? min}
						aria-valuemax={slider.values[index + 1] ?? max}
						aria-valuetext={text}
					>
						{thumbLabel && (
							<span id={labelId} hidden>
								{thumbLabel}
							</span>
						)}
						<span className="v-slider__tip" aria-hidden="true">
							{text}
						</span>
					</SliderPrimitive.Thumb>
				);
			})}
			{slider.stops.length > 0 && (
				<span className="v-slider__labels" aria-hidden="true">
					{slider.stops.map((mark) => (
						<span
							key={mark.value}
							className="v-slider__label"
							style={{
								insetInlineStart: `${((mark.value - min) / (max - min)) * 100}%`,
							}}
						>
							{mark.label}
						</span>
					))}
				</span>
			)}
			{name &&
				slider.values.map((current, index) => (
					<input
						key={index === 0 ? "start" : "end"}
						type="hidden"
						name={range ? `${name}[]` : name}
						value={current}
						form={form}
						disabled={disabled}
					/>
				))}
		</SliderPrimitive.Root>
	);
});
