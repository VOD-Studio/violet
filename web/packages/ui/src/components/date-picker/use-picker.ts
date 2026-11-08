"use client";

import { type KeyboardEvent, type RefObject, useEffect, useRef, useState } from "react";
import {
	addDays,
	addMonths,
	type DateConstraints,
	formatPickerValue,
	isAllowed,
	parsePickerValue,
	startOfMonth,
} from "./date-utils";

interface PickerStateProps extends DateConstraints {
	value: string;
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	disabled?: boolean;
	readOnly?: boolean;
}

export interface PickerState {
	open: boolean;
	setOpen: (open: boolean) => void;
	active: Date;
	setActive: (date: Date) => void;
	month: Date;
	setMonth: (date: Date) => void;
	keyboard: boolean;
	months: boolean;
	changeMonths: (open: boolean, month: Date) => void;
	anchor: RefObject<HTMLDivElement | null>;
	panel: RefObject<HTMLDivElement | null>;
	dayDisabled: (date: Date) => boolean;
	navigate: (
		event: KeyboardEvent<HTMLInputElement>,
		select: () => void,
		commitDraft: () => void,
		dirty: boolean,
		preview?: (date: Date) => void,
	) => void;
}

export function usePicker(
	{
		value,
		open: controlledOpen,
		defaultOpen = false,
		onOpenChange,
		disabled,
		readOnly,
		...constraints
	}: PickerStateProps,
	onVisibilityChange: (open: boolean) => void,
): PickerState {
	const [internalOpen, setInternalOpen] = useState(defaultOpen);
	const open = !disabled && !readOnly && (controlledOpen ?? internalOpen);
	const initial = parsePickerValue(value, constraints.mode) ?? new Date();
	const [active, setActive] = useState(initial);
	const [month, setMonth] = useState(() => startOfMonth(initial));
	const [keyboard, setKeyboard] = useState(false);
	const [months, setMonths] = useState(false);
	const changeMonths = (next: boolean, month: Date) => {
		setMonths(next);
		setActive(month);
	};
	const anchor = useRef<HTMLDivElement>(null);
	const panel = useRef<HTMLDivElement>(null);
	const wasOpen = useRef(false);
	const openingNavigation = useRef(false);
	const lastInput = useRef<HTMLInputElement | null>(null);
	useEffect(() => {
		const node = anchor.current;
		if (!node) return;
		const remember = (event: FocusEvent) => {
			if (event.target instanceof HTMLInputElement) lastInput.current = event.target;
		};
		node.addEventListener("focusin", remember);
		return () => node.removeEventListener("focusin", remember);
	}, []);
	const visibilityChanged = useRef(onVisibilityChange);
	visibilityChanged.current = onVisibilityChange;
	const dayDisabled = (date: Date) => !isAllowed(date, constraints, true);
	const setOpen = (next: boolean) => {
		if (next && (disabled || readOnly)) return;
		// 焦点在面板内时直接关闭会落到 body；先还给最近使用的输入。
		if (!next && open && panel.current?.contains(document.activeElement))
			lastInput.current?.focus({ preventScroll: true });
		if (controlledOpen === undefined) setInternalOpen(next);
		if (next !== open) onOpenChange?.(next);
	};
	useEffect(() => {
		if (open && !wasOpen.current && !openingNavigation.current) {
			let next = parsePickerValue(value, constraints.mode) ?? new Date();
			const min = constraints.min && parsePickerValue(constraints.min, constraints.mode);
			const max = constraints.max && parsePickerValue(constraints.max, constraints.mode);
			if (min && next < min) next = min;
			if (max && next > max) next = max;
			setActive(next);
			setMonth(startOfMonth(next));
			setKeyboard(false);
			setMonths(false);
		}
		if (wasOpen.current !== open) visibilityChanged.current(open);
		wasOpen.current = open;
		openingNavigation.current = false;
	}, [open, value, constraints.mode, constraints.min, constraints.max]);
	const navigate = (
		event: KeyboardEvent<HTMLInputElement>,
		select: () => void,
		commitDraft: () => void,
		dirty: boolean,
		preview?: (date: Date) => void,
	) => {
		if (event.defaultPrevented || event.nativeEvent.isComposing || disabled || readOnly) return;
		if (event.key === "Escape") {
			if (open) {
				event.preventDefault();
				setOpen(false);
			}
			return;
		}
		if (event.key === "Enter") {
			if (!open && !dirty) return;
			event.preventDefault();
			if (dirty) commitDraft();
			else if (months) {
				setMonth(startOfMonth(active));
				setMonths(false);
			} else select();
			return;
		}
		if (constraints.mode === "time") {
			if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				event.preventDefault();
				setOpen(true);
			}
			return;
		}
		let target: Date;
		let direction = 1;
		if (event.key === "ArrowUp" || event.key === "ArrowDown") {
			direction = event.key === "ArrowUp" ? -1 : 1;
			target = months ? addMonths(active, direction * 3) : addDays(active, direction * 7);
		} else if (event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
			direction = event.key === "ArrowLeft" ? -1 : 1;
			target = months ? addMonths(active, direction) : addDays(active, direction);
		} else if (event.key === "PageUp" || event.key === "PageDown") {
			direction = event.key === "PageUp" ? -1 : 1;
			target = addMonths(active, direction * (event.shiftKey || months ? 12 : 1));
		} else return;
		event.preventDefault();
		setOpen(true);
		if (months) {
			if (target.getFullYear() >= 1 && target.getFullYear() <= 9999) {
				if (!open) openingNavigation.current = true;
				setActive(target);
				setMonth(startOfMonth(target));
				setKeyboard(true);
			}
			return;
		}
		const lower = constraints.min && parsePickerValue(constraints.min, constraints.mode);
		const upper = constraints.max && parsePickerValue(constraints.max, constraints.mode);
		// 有限搜索防止所有日期均被用户回调禁用时卡死；最多跨一个公历世纪。
		for (let count = 0; count < 36600; count++, target = addDays(target, direction)) {
			if (target.getFullYear() < 1 || target.getFullYear() > 9999) return;
			const key = formatPickerValue(target, "date");
			if (
				(lower && key < formatPickerValue(lower, "date")) ||
				(upper && key > formatPickerValue(upper, "date"))
			)
				return;
			if (!dayDisabled(target)) {
				if (!open) openingNavigation.current = true;
				setActive(target);
				setMonth(startOfMonth(target));
				setKeyboard(true);
				preview?.(target);
				return;
			}
		}
	};
	return {
		open,
		setOpen,
		active,
		setActive,
		month,
		setMonth,
		keyboard,
		months,
		changeMonths,
		anchor,
		panel,
		dayDisabled,
		navigate,
	};
}

export function usePickerReset(input: RefObject<HTMLInputElement | null>, reset: () => void) {
	const latest = useRef(reset);
	latest.current = reset;
	useEffect(() => {
		const node = input.current;
		if (!node) return;
		let live = true;
		const pending = new WeakSet<Event>();
		const listener = (event: Event) => {
			if (!node.form || event.target !== node.form || pending.has(event)) return;
			pending.add(event);
			const finish = () => {
				if (!live) return;
				if (event.eventPhase !== Event.NONE) {
					setTimeout(finish, 0);
					return;
				}
				if (!event.defaultPrevented) latest.current();
			};
			queueMicrotask(finish);
		};
		const scopes = new Set([node.ownerDocument, node.getRootNode()]);
		for (const scope of scopes) scope.addEventListener("reset", listener, true);
		return () => {
			live = false;
			for (const scope of scopes) scope.removeEventListener("reset", listener, true);
		};
	}, [input]);
}
