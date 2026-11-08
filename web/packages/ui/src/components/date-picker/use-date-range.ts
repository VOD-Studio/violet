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
	addMonths,
	type DateConstraints,
	formatPickerValue,
	isAllowed,
	orderRange,
	parsePickerValue,
	startOfMonth,
	withDate,
} from "./date-utils";
import type { DateRange, DateRangePickerProps } from "./types";
import { type PickerState, usePicker, usePickerReset } from "./use-picker";

type Endpoint = "start" | "end";

export interface DateRangeState {
	picker: PickerState;
	value: DateRange;
	pending: DateRange;
	setPending: Dispatch<SetStateAction<DateRange>>;
	text: Record<Endpoint, string>;
	setText: Dispatch<SetStateAction<Record<Endpoint, string>>>;
	dirty: Record<Endpoint, boolean>;
	setDirty: Dispatch<SetStateAction<Record<Endpoint, boolean>>>;
	endpoint: Endpoint;
	setEndpoint: Dispatch<SetStateAction<Endpoint>>;
	preview: Date | null;
	setPreview: Dispatch<SetStateAction<Date | null>>;
	selecting: boolean;
	announcement: string;
	rejected: boolean;
	setRejected: Dispatch<SetStateAction<boolean>>;
	input: RefObject<HTMLInputElement | null>;
	endInput: RefObject<HTMLInputElement | null>;
	constraints: DateConstraints;
	validRange: (range: DateRange) => boolean;
	commit: (range: DateRange) => void;
	commitText: (side: Endpoint) => void;
	choose: (date: Date) => void;
	focus: (side: Endpoint) => void;
}

export function useDateRange(props: DateRangePickerProps): DateRangeState {
	const {
		value: controlledValue,
		defaultValue = {},
		onChange,
		mode = "date",
		min,
		max,
		disabledDate,
		required,
		allowOpenEnded = true,
	} = props;
	const [internal, setInternal] = useState(defaultValue);
	const value = controlledValue ?? internal;
	const { start, end } = value;
	const [pending, setPending] = useState(value);
	const [text, setText] = useState({ start: value.start ?? "", end: value.end ?? "" });
	const [dirty, setDirty] = useState({ start: false, end: false });
	const [endpoint, setEndpoint] = useState<Endpoint>("start");
	const [preview, setPreview] = useState<Date | null>(null);
	const [selecting, setSelecting] = useState(false);
	const [announcement, setAnnouncement] = useState("");
	const [rejected, setRejected] = useState(false);
	const input = useRef<HTMLInputElement>(null);
	const endInput = useRef<HTMLInputElement>(null);
	const constraints = { mode, min, max, disabledDate };
	const resetDraft = useCallback(() => {
		setPending({ start, end });
		setText({ start: start ?? "", end: end ?? "" });
		setDirty({ start: false, end: false });
		setPreview(null);
		setSelecting(false);
	}, [start, end]);
	const picker = usePicker(
		{
			...props,
			...constraints,
			value: value[endpoint] ?? value.start ?? value.end ?? "",
		},
		resetDraft,
	);
	useEffect(resetDraft, [resetDraft]);
	usePickerReset(input, () => {
		const next = controlledValue ?? defaultValue;
		if (controlledValue === undefined) setInternal(defaultValue);
		setPending(next);
		setText({ start: next.start ?? "", end: next.end ?? "" });
		setDirty({ start: false, end: false });
		setRejected(false);
		picker.setOpen(false);
	});
	useEffect(() => {
		const partial = !!pending.start !== !!pending.end;
		const message = !allowOpenEnded && partial ? "请选择完整的日期范围" : "";
		input.current?.setCustomValidity(message);
		endInput.current?.setCustomValidity(message);
	}, [pending.start, pending.end, allowOpenEnded]);
	const validRange = (range: DateRange) => {
		if (required && (!range.start || !range.end)) return false;
		if (!allowOpenEnded && !!range.start !== !!range.end) return false;
		return [range.start, range.end].every((raw) => {
			if (!raw) return true;
			const date = parsePickerValue(raw, mode);
			return !!date && isAllowed(date, constraints);
		});
	};
	const commit = (range: DateRange) => {
		if (!validRange(range)) return;
		const start = range.start ? parsePickerValue(range.start, mode) : null;
		const end = range.end ? parsePickerValue(range.end, mode) : null;
		const next = orderRange({
			start: start ? formatPickerValue(start, mode) : undefined,
			end: end ? formatPickerValue(end, mode) : undefined,
		});
		if (controlledValue === undefined) setInternal(next);
		const displayed = controlledValue ?? next;
		setPending(displayed);
		setText({ start: displayed.start ?? "", end: displayed.end ?? "" });
		setDirty({ start: false, end: false });
		setSelecting(false);
		setRejected(false);
		setPreview(null);
		onChange?.(next);
	};
	const commitText = (side: Endpoint) => {
		if (!dirty[side]) return;
		const raw = text[side].trim();
		const date = raw ? parsePickerValue(raw, mode) : null;
		const formatted = date ? formatPickerValue(date, mode) : undefined;
		const next: DateRange =
			side === "start" ? { ...pending, start: formatted } : { ...pending, end: formatted };
		const accepted = raw ? !!date && isAllowed(date, constraints) : !required;
		if (!accepted) {
			setText((current) => ({ ...current, [side]: pending[side] ?? "" }));
			setDirty((current) => ({ ...current, [side]: false }));
			setRejected(true);
			return;
		}
		if (validRange(next)) commit(next);
		else {
			// 必填或闭区间要等另一端完成才能整体提交，先保留这一端的合法草稿。
			setPending(next);
			setText({ start: next.start ?? "", end: next.end ?? "" });
			setDirty({ start: false, end: false });
			setRejected(false);
		}
		if (date) {
			picker.setActive(date);
			picker.setMonth(startOfMonth(date));
		}
	};
	const choose = (day: Date) => {
		if (picker.dayDisabled(day)) return;
		let date = withDate(day, pending[endpoint] ?? "", mode);
		const lower = min && parsePickerValue(min, mode);
		const upper = max && parsePickerValue(max, mode);
		if (lower && date < lower) date = lower;
		if (upper && date > upper) date = upper;
		if (!isAllowed(date, constraints)) return;
		const next = formatPickerValue(date, mode);
		picker.setActive(date);
		if (date < picker.month || date >= addMonths(picker.month, 2))
			picker.setMonth(startOfMonth(date));
		setRejected(false);
		const startsRange = endpoint === "start" && !(pending.end && !pending.start);
		if (startsRange) {
			setPending({ start: next });
			setText({ start: next, end: "" });
			setEndpoint("end");
			setSelecting(true);
			setPreview(null);
			setAnnouncement(`已选起点 ${day.getMonth() + 1} 月 ${day.getDate()} 日，请选终点`);
		} else {
			const range = orderRange(
				endpoint === "start" ? { ...pending, start: next } : { ...pending, end: next },
			);
			setPending(range);
			setText({ start: range.start ?? "", end: range.end ?? "" });
			setSelecting(false);
			setPreview(null);
			setAnnouncement(
				range.start && range.end
					? `已选范围 ${range.start} 至 ${range.end}`
					: `已选${endpoint === "start" ? "起点" : "终点"} ${day.getMonth() + 1} 月 ${day.getDate()} 日`,
			);
			if (mode === "date" && validRange(range)) {
				commit(range);
				picker.setOpen(false);
			}
		}
		setDirty({ start: false, end: false });
	};
	const focus = (side: Endpoint) => {
		setEndpoint(side);
		setPreview(null);
		setSelecting(false);
		const date = parsePickerValue(pending[side] ?? "", mode);
		if (date) {
			picker.setActive(date);
			picker.setMonth(startOfMonth(date));
		}
		picker.setOpen(true);
	};
	return {
		picker,
		value,
		pending,
		setPending,
		text,
		setText,
		dirty,
		setDirty,
		endpoint,
		setEndpoint,
		preview,
		setPreview,
		selecting,
		announcement,
		rejected,
		setRejected,
		input,
		endInput,
		constraints,
		validRange,
		commit,
		commitText,
		choose,
		focus,
	};
}
