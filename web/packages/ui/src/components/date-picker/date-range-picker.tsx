"use client";

import { useComposedRefs } from "radix-ui/internal";
import { type ComponentProps, useId } from "react";
import { useFieldControl } from "../field";
import { DateRangePanel } from "./date-range-panel";
import { DateTrigger } from "./date-trigger";
import { formatPickerValue } from "./date-utils";
import type { DateRangePickerProps } from "./types";
import { useDateRange } from "./use-date-range";

/** 双月日期范围；端点输入支持开放区间，日期时间在确定时一次提交。 */
export function DateRangePicker(props: DateRangePickerProps) {
	const {
		ref,
		value: _value,
		defaultValue: _defaultValue,
		onChange: _onChange,
		mode = "date",
		min: _min,
		max: _max,
		disabledDate: _disabledDate,
		presets: _presets,
		open: _open,
		defaultOpen: _defaultOpen,
		onOpenChange: _onOpenChange,
		container: _container,
		collisionBoundary: _boundary,
		variant,
		controlSize,
		classNames,
		invalid,
		valid,
		clearable = true,
		clearLabel,
		required,
		disabled,
		readOnly,
		id,
		name,
		startName,
		endName,
		allowOpenEnded: _allowOpenEnded,
		endInputProps,
		onFocus,
		onBlur,
		onClick,
		onKeyDown,
		...inputProps
	} = props;
	const state = useDateRange(props);
	const field = useFieldControl();
	const { picker } = state;
	const composedRef = useComposedRefs(ref, state.input);
	const endRef = useComposedRefs(endInputProps?.ref, state.endInput);
	const generatedId = useId();
	const inputId = id ?? generatedId;
	const panelId = `${inputId}-panel`;
	const calendarId = `${inputId}-day`;
	const invalidState =
		invalid ??
		(inputProps["aria-invalid"] === true ||
			inputProps["aria-invalid"] === "true" ||
			inputProps["aria-invalid"] === "grammar" ||
			inputProps["aria-invalid"] === "spelling");
	const activeId = picker.months
		? `${calendarId}-month-${picker.active.getFullYear()}-${picker.active.getMonth()}`
		: `${calendarId}-${formatPickerValue(picker.active, "date")}`;
	const explicitLabel = inputProps["aria-label"];
	const labelledBy =
		inputProps["aria-labelledby"] ?? (explicitLabel ? undefined : field["aria-labelledby"]);
	const endpointProps = (side: "start" | "end"): ComponentProps<"input"> => {
		const extra = side === "end" ? endInputProps : undefined;
		const endpointId = side === "start" ? inputId : (extra?.id ?? `${inputId}-end`);
		return {
			...inputProps,
			...extra,
			ref: side === "start" ? composedRef : endRef,
			id: endpointId,
			name:
				side === "start"
					? (startName ?? (name ? `${name}.start` : undefined))
					: (endName ?? (name ? `${name}.end` : undefined)),
			form: inputProps.form,
			disabled,
			readOnly,
			required,
			"aria-label":
				extra?.["aria-label"] ??
				(explicitLabel
					? side === "start"
						? explicitLabel
						: `${explicitLabel}：结束日期`
					: labelledBy
						? side === "start"
							? "开始日期"
							: "结束日期"
						: side === "start"
							? "开始日期"
							: "日期范围：结束日期"),
			"aria-labelledby":
				extra?.["aria-labelledby"] ??
				(labelledBy ? `${labelledBy} ${endpointId}` : undefined),
			"aria-invalid": invalidState || state.rejected || undefined,
			"aria-haspopup": "dialog",
			"aria-expanded": picker.open,
			"aria-controls": picker.open ? panelId : undefined,
			"aria-activedescendant": picker.open ? activeId : undefined,
			value: state.text[side],
			placeholder:
				extra?.placeholder ??
				inputProps.placeholder ??
				(side === "start" ? "开始日期" : "结束日期"),
			onChange: (event) => {
				const next = event.target.value;
				state.setText((current) => ({ ...current, [side]: next }));
				state.setDirty((current) => ({ ...current, [side]: true }));
				state.setRejected(false);
			},
			onFocus: (event) => {
				(extra?.onFocus ?? onFocus)?.(event);
				if (!event.defaultPrevented) state.focus(side);
			},
			onClick: (event) => {
				(extra?.onClick ?? onClick)?.(event);
				if (!event.defaultPrevented) state.focus(side);
			},
			onBlur: (event) => {
				(extra?.onBlur ?? onBlur)?.(event);
				if (event.defaultPrevented) return;
				state.commitText(side);
				const target = event.relatedTarget as Node | null;
				if (
					!picker.anchor.current?.contains(target) &&
					!picker.panel.current?.contains(target)
				)
					picker.setOpen(false);
			},
			onKeyDown: (event) => {
				(extra?.onKeyDown ?? onKeyDown)?.(event);
				picker.navigate(
					event,
					() => state.choose(picker.active),
					() => state.commitText(side),
					state.dirty[side],
					state.selecting ? state.setPreview : undefined,
				);
			},
		};
	};
	return (
		<>
			<DateTrigger
				anchorRef={picker.anchor}
				variant={variant}
				controlSize={controlSize}
				classNames={classNames}
				invalid={invalidState || state.rejected}
				valid={valid}
				mode={mode}
				hasValue={!!state.value.start || !!state.value.end}
				clearable={clearable}
				clearLabel={clearLabel}
				onOpen={() => picker.setOpen(true)}
				onClear={() => {
					state.input.current?.focus();
					state.commit({});
					picker.setOpen(false);
				}}
				inputProps={endpointProps("start")}
				endInputProps={endpointProps("end")}
			/>
			<DateRangePanel state={state} props={props} panelId={panelId} calendarId={calendarId} />
		</>
	);
}
