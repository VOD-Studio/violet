"use client";

import { useComposedRefs } from "radix-ui/internal";
import { useId } from "react";
import { DatePanel } from "./date-panel";
import { DateTrigger } from "./date-trigger";
import { formatPickerValue } from "./date-utils";
import type { DatePickerProps } from "./types";
import { useDateValue } from "./use-date-value";

/** 可直接键入的本地日期选择器；日期立即提交，面板里的时间调整在确定时提交。 */
export function DatePicker(props: DatePickerProps) {
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
		onFocus,
		onBlur,
		onClick,
		onKeyDown,
		...inputProps
	} = props;
	const state = useDateValue(props);
	const { picker } = state;
	const composedRef = useComposedRefs(ref, state.input);
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
				hasValue={!!state.value}
				clearable={clearable}
				clearLabel={clearLabel}
				onOpen={() => picker.setOpen(true)}
				onClear={() => {
					state.input.current?.focus();
					state.commit("");
					picker.setOpen(false);
				}}
				inputProps={{
					...inputProps,
					ref: composedRef,
					id: inputId,
					value: state.text,
					required,
					disabled,
					readOnly,
					placeholder:
						inputProps.placeholder ??
						(mode === "date"
							? "YYYY-MM-DD"
							: mode === "time"
								? "HH:mm"
								: "YYYY-MM-DD HH:mm"),
					"aria-invalid": invalidState || state.rejected || undefined,
					"aria-haspopup": "dialog",
					"aria-expanded": picker.open,
					"aria-controls": picker.open ? panelId : undefined,
					"aria-activedescendant": picker.open && mode !== "time" ? activeId : undefined,
					onChange: (event) => {
						state.setText(event.target.value);
						state.setDirty(true);
						state.setRejected(false);
					},
					onFocus: (event) => {
						onFocus?.(event);
						if (!event.defaultPrevented) picker.setOpen(true);
					},
					onClick: (event) => {
						onClick?.(event);
						if (!event.defaultPrevented) picker.setOpen(true);
					},
					onBlur: (event) => {
						onBlur?.(event);
						if (event.defaultPrevented) return;
						state.commitText();
						const target = event.relatedTarget as Node | null;
						if (
							!picker.anchor.current?.contains(target) &&
							!picker.panel.current?.contains(target)
						)
							picker.setOpen(false);
					},
					onKeyDown: (event) => {
						onKeyDown?.(event);
						picker.navigate(
							event,
							() => state.choose(picker.active),
							state.commitText,
							state.dirty,
						);
					},
				}}
			/>
			<DatePanel state={state} props={props} panelId={panelId} calendarId={calendarId} />
		</>
	);
}
