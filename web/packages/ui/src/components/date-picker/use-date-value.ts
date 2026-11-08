"use client";

import {
	type Dispatch,
	type RefObject,
	type SetStateAction,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	type DateConstraints,
	formatPickerValue,
	isAllowed,
	parsePickerValue,
	startOfMonth,
	withDate,
} from "./date-utils";
import type { DatePickerProps } from "./types";
import { type PickerState, usePicker, usePickerReset } from "./use-picker";

export interface DateValueState {
	picker: PickerState;
	input: RefObject<HTMLInputElement | null>;
	value: string;
	text: string;
	setText: Dispatch<SetStateAction<string>>;
	pending: string;
	pendingDate: Date | null;
	dirty: boolean;
	setDirty: Dispatch<SetStateAction<boolean>>;
	rejected: boolean;
	setRejected: Dispatch<SetStateAction<boolean>>;
	constraints: DateConstraints;
	time: string;
	timeDate: (time: string) => Date | null;
	changeTime: (time: string) => void;
	now: () => void;
	commit: (value: string) => void;
	commitText: () => void;
	choose: (date: Date) => void;
}

export function useDateValue(props: DatePickerProps): DateValueState {
	const {
		value: controlledValue,
		defaultValue = "",
		onChange,
		mode = "date",
		min,
		max,
		disabledDate,
		required,
	} = props;
	const [internalValue, setInternalValue] = useState(defaultValue);
	const value = controlledValue ?? internalValue;
	const [text, setText] = useState(value);
	const [pending, setPending] = useState(value);
	const [dirty, setDirty] = useState(false);
	const [rejected, setRejected] = useState(false);
	const input = useRef<HTMLInputElement>(null);
	const constraints = { mode, min, max, disabledDate };
	const resetDraft = useCallback(() => {
		setText(value);
		setPending(value);
		setDirty(false);
	}, [value]);
	const picker = usePicker({ ...props, ...constraints, value }, resetDraft);
	useEffect(resetDraft, [resetDraft]);
	usePickerReset(input, () => {
		if (controlledValue === undefined) setInternalValue(defaultValue);
		setText(controlledValue ?? defaultValue);
		setPending(controlledValue ?? defaultValue);
		setDirty(false);
		setRejected(false);
		picker.setOpen(false);
	});
	const commit = (next: string) => {
		if (required && !next) return;
		if (controlledValue === undefined) setInternalValue(next);
		setText(controlledValue ?? next);
		setPending(controlledValue ?? next);
		setDirty(false);
		setRejected(false);
		onChange?.(next);
	};
	const commitText = () => {
		if (!dirty) return;
		const date = parsePickerValue(text, mode);
		if (!text.trim() && !required) commit("");
		else if (date && isAllowed(date, constraints)) {
			commit(formatPickerValue(date, mode));
			picker.setActive(date);
			picker.setMonth(startOfMonth(date));
		} else {
			setText(value);
			setDirty(false);
			setRejected(true);
		}
	};
	const choose = (day: Date) => {
		if (picker.dayDisabled(day)) return;
		let date = withDate(day, pending, mode);
		if (mode === "datetime") {
			const lower = min && parsePickerValue(min, mode);
			const upper = max && parsePickerValue(max, mode);
			if (lower && date < lower) date = lower;
			if (upper && date > upper) date = upper;
		}
		if (!isAllowed(date, constraints)) return;
		picker.setActive(date);
		picker.setMonth(startOfMonth(day));
		const next = formatPickerValue(date, mode);
		setRejected(false);
		if (mode === "date") {
			commit(next);
			picker.setOpen(false);
		} else {
			setPending(next);
			setText(next);
			setDirty(false);
		}
	};
	const pendingDate = parsePickerValue(pending, mode);
	const time = pendingDate ? formatPickerValue(pendingDate, "time") : "00:00";
	const timeDate = (next: string) =>
		parsePickerValue(
			mode === "time"
				? next
				: `${formatPickerValue(pendingDate ?? picker.active, "date")}T${next}`,
			mode,
		);
	const changeTime = (next: string) => {
		const date = timeDate(next);
		if (!date || !isAllowed(date, constraints)) return;
		const formatted = formatPickerValue(date, mode);
		setPending(formatted);
		setText(formatted);
		setDirty(false);
	};
	const now = () => {
		const current = new Date();
		if (!isAllowed(current, constraints)) return;
		const next = formatPickerValue(current, mode);
		setPending(next);
		setText(next);
		setDirty(false);
		picker.setActive(current);
		picker.setMonth(startOfMonth(current));
	};
	return {
		picker,
		input,
		value,
		text,
		setText,
		pending,
		pendingDate,
		dirty,
		setDirty,
		rejected,
		setRejected,
		constraints,
		time,
		timeDate,
		changeTime,
		now,
		commit,
		commitText,
		choose,
	};
}
