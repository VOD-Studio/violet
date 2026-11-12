import type { SliderMark } from "./types";

export function snapValue(
	value: number,
	min: number,
	max: number,
	step: number,
	marks: readonly SliderMark[],
) {
	const bounded = Math.max(min, Math.min(max, value));
	if (marks.length) {
		return marks.reduce(
			(nearest, mark) =>
				Math.abs(mark.value - bounded) < Math.abs(nearest - bounded) ? mark.value : nearest,
			marks[0].value,
		);
	}
	const snapped = min + Math.round((bounded - min) / step) * step;
	return Math.max(min, Math.min(max, Number(snapped.toFixed(10))));
}

export function normalizeValues(
	values: number[],
	min: number,
	max: number,
	step: number,
	marks: readonly SliderMark[],
) {
	return values
		.slice(0, 2)
		.map((value) => snapValue(value, min, max, step, marks))
		.sort((a, b) => a - b);
}

export function moveValue(
	values: number[],
	index: number,
	value: number,
	min: number,
	max: number,
	step: number,
	marks: readonly SliderMark[],
) {
	const next = [...values];
	next[index] = Math.max(
		values[index - 1] ?? min,
		Math.min(values[index + 1] ?? max, snapValue(value, min, max, step, marks)),
	);
	return next;
}

export function keyboardValue(
	key: string,
	shift: boolean,
	value: number,
	min: number,
	max: number,
	step: number,
	marks: readonly SliderMark[],
) {
	if (key === "Home") return min;
	if (key === "End") return max;
	if (key === "PageUp") return value + (max - min) / 10;
	if (key === "PageDown") return value - (max - min) / 10;
	const direction =
		key === "ArrowRight" || key === "ArrowUp"
			? 1
			: key === "ArrowLeft" || key === "ArrowDown"
				? -1
				: 0;
	if (!direction) return undefined;
	if (marks.length) {
		const index = marks.findIndex((mark) => mark.value === value);
		return marks[Math.max(0, Math.min(marks.length - 1, index + direction * (shift ? 10 : 1)))]
			.value;
	}
	return value + direction * step * (shift ? 10 : 1);
}
