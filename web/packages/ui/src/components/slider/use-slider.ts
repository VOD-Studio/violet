import type { KeyboardEvent, PointerEvent, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import type { SliderProps } from "./types";
import { keyboardValue, moveValue, normalizeValues } from "./values";

export function useSlider(
	{
		value,
		defaultValue,
		onValueChange,
		onValueCommit,
		min = 0,
		max = 100,
		step = 1,
		marks = [],
		disabled,
		readOnly,
		form,
	}: SliderProps,
	root: RefObject<HTMLSpanElement | null>,
) {
	const stops = marks
		.filter((mark) => mark.value >= min && mark.value <= max)
		.sort((a, b) => a.value - b.value);
	const initial = useRef(defaultValue ?? [min]);
	const [internal, setInternal] = useState(initial.current);
	const values = normalizeValues(value ?? internal, min, max, step, stops);
	const latest = useRef(values);
	latest.current = values;
	const active = useRef(0);
	const thumbs = useRef<(HTMLSpanElement | null)[]>([]);
	const pointer = useRef<{ id: number; candidate: number; start: string } | null>(null);
	const [motion, setMotion] = useState<"jump" | "drag" | undefined>();
	const [dragging, setDragging] = useState<number | null>(null);
	const blocked = disabled || readOnly;

	useEffect(() => {
		const owner = form
			? root.current?.ownerDocument.getElementById(form)
			: root.current?.closest("form");
		if (!(owner instanceof HTMLFormElement)) return;
		function reset(event: Event) {
			queueMicrotask(() => {
				if (event.defaultPrevented || value !== undefined) return;
				setInternal(initial.current);
				setMotion(undefined);
			});
		}
		owner.addEventListener("reset", reset);
		return () => owner.removeEventListener("reset", reset);
	}, [form, root, value]);

	function update(candidate: number, commit = false) {
		if (blocked) return;
		const next = moveValue(latest.current, active.current, candidate, min, max, step, stops);
		if (String(next) === String(latest.current)) return;
		if (value === undefined) {
			latest.current = next;
			setInternal(next);
		}
		onValueChange?.(next);
		if (commit) onValueCommit?.(next);
	}

	function pointerValue(event: PointerEvent<HTMLSpanElement>) {
		const rect = event.currentTarget.getBoundingClientRect();
		const ratio = rect.width ? (event.clientX - rect.left) / rect.width : 0;
		return (
			min +
			Math.max(0, Math.min(1, event.currentTarget.dir === "rtl" ? 1 - ratio : ratio)) *
				(max - min)
		);
	}

	function pointerDown(event: PointerEvent<HTMLSpanElement>) {
		if (blocked || event.button !== 0) {
			event.preventDefault();
			return;
		}
		const candidate = pointerValue(event);
		const thumb = (event.target as Element).closest<HTMLElement>("[data-slider-index]");
		active.current = thumb
			? Number(thumb.dataset.sliderIndex)
			: values.reduce(
					(nearest, current, index) =>
						Math.abs(current - candidate) < Math.abs(values[nearest] - candidate)
							? index
							: nearest,
					0,
				);
		pointer.current = { id: event.pointerId, candidate, start: String(values) };
		setDragging(active.current);
		setMotion(thumb ? "drag" : "jump");
	}

	function pointerMove(event: PointerEvent<HTMLSpanElement>) {
		if (!pointer.current || pointer.current.id !== event.pointerId) return;
		pointer.current.candidate = pointerValue(event);
		setMotion("drag");
	}

	function pointerEnd(event: PointerEvent<HTMLSpanElement>) {
		if (!pointer.current || pointer.current.id !== event.pointerId) return;
		if (!blocked && pointer.current.start !== String(latest.current))
			onValueCommit?.(latest.current);
		pointer.current = null;
		setDragging(null);
	}

	function change() {
		if (!pointer.current) return;
		// Radix 会排序跨越的值并聚焦排序后的滑钮；这里要保留起点、终点各自的身份。
		update(pointer.current.candidate);
		thumbs.current[active.current]?.focus({ preventScroll: true, focusVisible: false });
	}

	function keyDown(event: KeyboardEvent<HTMLSpanElement>) {
		const thumb = (event.target as Element).closest<HTMLElement>("[data-slider-index]");
		if (!thumb) return;
		active.current = Number(thumb.dataset.sliderIndex);
		const candidate = keyboardValue(
			event.key,
			event.shiftKey,
			values[active.current],
			min,
			max,
			step,
			stops,
		);
		if (candidate === undefined) return;
		event.preventDefault();
		setMotion(undefined);
		update(candidate, true);
	}
	return {
		values,
		stops,
		thumbs,
		motion,
		dragging,
		pointerDown,
		pointerMove,
		pointerEnd,
		change,
		keyDown,
	};
}
