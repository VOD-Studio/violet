"use client";

import { ChevronDown } from "lucide-react";
import { type CSSProperties, useLayoutEffect, useRef } from "react";
import {
	addDays,
	addMonths,
	formatPickerValue,
	fullDateName,
	sameDay,
	startOfMonth,
} from "./date-utils";

const CELL = 36;
const ROW_WIDTH = CELL * 7;
const CIRCLE_INSET = 2;
const STAGGER_MS = 28;

export interface MonthViewProps {
	id: string;
	month: Date;
	onMonthChange: (month: Date) => void;
	active: Date;
	keyboard: boolean;
	months: boolean;
	onMonthsChange: (open: boolean, month: Date) => void;
	selected?: Date | null;
	range?: { start?: Date | null; end?: Date | null };
	preview?: Date | null;
	onPreview?: (date: Date | null) => void;
	onSelect: (date: Date) => void;
	isDisabled: (date: Date) => boolean;
}

interface Band {
	x: number;
	width: number;
}

/** 一行里被区间覆盖的横向范围；起止日期的圆在带的端点上，空行按所在侧收到边缘。 */
function rowBand(
	keys: string[],
	inMonth: boolean[],
	firstKey: string | null,
	lastKey: string | null,
	hollowKey: string | null,
): Band {
	let c0 = -1;
	let c1 = -1;
	if (firstKey && lastKey && firstKey !== lastKey) {
		keys.forEach((key, column) => {
			if (!inMonth[column] || key < firstKey || key > lastKey) return;
			if (c0 < 0) c0 = column;
			c1 = column;
		});
	}
	if (c0 < 0) return { x: firstKey && keys[6] < firstKey ? ROW_WIDTH : 0, width: 0 };
	// 空心的预览终点只让带停在圆环边缘，不钻进环里
	const left =
		keys[c0] === firstKey
			? c0 * CELL + (hollowKey === firstKey ? CELL - CIRCLE_INSET : CELL / 2)
			: c0 * CELL + CIRCLE_INSET;
	const right =
		keys[c1] === lastKey
			? c1 * CELL + (hollowKey === lastKey ? CIRCLE_INSET : CELL / 2)
			: (c1 + 1) * CELL - CIRCLE_INSET;
	return { x: left, width: Math.max(0, right - left) };
}

export function MonthView({
	id,
	month,
	onMonthChange,
	active,
	keyboard,
	months,
	onMonthsChange,
	selected,
	range,
	preview,
	onPreview,
	onSelect,
	isDisabled,
}: MonthViewProps) {
	const today = new Date();
	const first = startOfMonth(month);
	const start = addDays(first, -((first.getDay() + 6) % 7));
	const rangeEnd = preview ?? range?.end;
	const rangeStart = range?.start;
	const lo =
		rangeStart && rangeEnd ? (rangeStart < rangeEnd ? rangeStart : rangeEnd) : rangeStart;
	const hi = rangeStart && rangeEnd ? (rangeStart < rangeEnd ? rangeEnd : rangeStart) : rangeEnd;
	const firstKey = lo ? formatPickerValue(lo, "date") : null;
	const lastKey = hi ? formatPickerValue(hi, "date") : null;
	const anchorKey = rangeStart ? formatPickerValue(rangeStart, "date") : null;
	const hollowKey =
		preview && !sameDay(preview, rangeStart) ? formatPickerValue(preview, "date") : null;

	const weeks = Array.from({ length: 6 }, (_, week) => {
		const cells = Array.from({ length: 7 }, (_, weekday) => addDays(start, week * 7 + weekday));
		return {
			cells,
			keys: cells.map((cell) => formatPickerValue(cell, "date")),
			inMonth: cells.map((cell) => cell.getMonth() === month.getMonth()),
		};
	});
	const gridFirst = weeks[0]?.keys[0] ?? "";
	const gridLast = weeks[5]?.keys[6] ?? "";
	const anchorRow = !anchorKey
		? 0
		: anchorKey < gridFirst
			? -1
			: anchorKey > gridLast
				? 6
				: weeks.findIndex((week) => week.keys.includes(anchorKey));
	const bands = weeks.map((week) =>
		rowBand(week.keys, week.inMonth, firstKey, lastKey, hollowKey),
	);
	const lastWidths = useRef<number[]>([]);
	// 带变长时由近及远逐行展开，缩短时由远及近逐行收回
	const delays = bands.map((band, week) => {
		const previous = lastWidths.current[week] ?? 0;
		if (band.width === previous) return 0;
		const order = Math.abs(week - anchorRow);
		return (band.width > previous ? order : Math.max(0, 5 - order)) * STAGGER_MS;
	});
	useLayoutEffect(() => {
		lastWidths.current = bands.map((band) => band.width);
	});

	const monthLabel = `${month.getFullYear()} 年 ${month.getMonth() + 1} 月`;
	const heading = (
		<div className="v-date-picker__heading">
			<button
				type="button"
				tabIndex={-1}
				className="v-date-picker__title"
				aria-label={months ? "返回日期选择" : "选择月份与年份"}
				aria-expanded={months}
				onClick={() => onMonthsChange(!months, month)}
			>
				{month.getFullYear()} 年{!months && ` ${month.getMonth() + 1} 月`}
				<ChevronDown aria-hidden data-expanded={months || undefined} />
			</button>
		</div>
	);

	if (months) {
		return (
			<section className="v-date-picker__calendar" aria-label={monthLabel}>
				{heading}
				<div className="v-date-picker__months" key={`months-${month.getFullYear()}`}>
					{Array.from({ length: 12 }, (_, index) => (
						<button
							key={index}
							id={`${id}-month-${month.getFullYear()}-${index}`}
							type="button"
							tabIndex={-1}
							className="v-date-picker__month"
							data-active={
								(keyboard &&
									active.getFullYear() === month.getFullYear() &&
									active.getMonth() === index) ||
								undefined
							}
							aria-pressed={month.getMonth() === index}
							aria-label={`${month.getFullYear()} 年 ${index + 1} 月`}
							onClick={() => {
								const next = addMonths(first, index - month.getMonth());
								onMonthChange(next);
								onMonthsChange(false, next);
							}}
						>
							{index + 1} 月
						</button>
					))}
				</div>
			</section>
		);
	}

	return (
		<section className="v-date-picker__calendar" aria-label={monthLabel}>
			{heading}
			<div className="v-date-picker__week" aria-hidden>
				{["一", "二", "三", "四", "五", "六", "日"].map((day) => (
					<span key={day}>{day}</span>
				))}
			</div>
			<div
				role="grid"
				aria-label={monthLabel}
				className="v-date-picker__grid"
				data-preview={preview ? "" : undefined}
				onPointerLeave={() => onPreview?.(null)}
			>
				{weeks.map((week, weekIndex) => (
					<div role="row" tabIndex={-1} className="v-date-picker__row" key={week.keys[0]}>
						<span
							className="v-date-picker__band"
							aria-hidden
							style={
								{
									"--band-x": `${bands[weekIndex]?.x ?? 0}px`,
									"--band-w": `${bands[weekIndex]?.width ?? 0}px`,
									"--band-delay": `${delays[weekIndex] ?? 0}ms`,
								} as CSSProperties
							}
						/>
						{week.cells.map((day, weekday) => {
							const key = week.keys[weekday] ?? "";
							const inMonth = week.inMonth[weekday] ?? false;
							const disabled =
								day.getFullYear() < 1 ||
								day.getFullYear() > 9999 ||
								isDisabled(day);
							const endpoint =
								inMonth &&
								(sameDay(day, range?.start) ||
									(!preview && sameDay(day, range?.end)));
							const pressed = inMonth && (sameDay(day, selected) || endpoint);
							return (
								<div
									role="gridcell"
									tabIndex={-1}
									id={inMonth ? `${id}-${key}` : undefined}
									aria-label={fullDateName(day)}
									aria-selected={pressed}
									key={key}
								>
									<button
										type="button"
										tabIndex={-1}
										aria-label={fullDateName(day)}
										aria-pressed={pressed}
										aria-current={sameDay(day, today) ? "date" : undefined}
										disabled={disabled}
										className="v-date-picker__day"
										data-outside={!inMonth || undefined}
										data-today={(inMonth && sameDay(day, today)) || undefined}
										data-selected={pressed || undefined}
										data-active={
											(inMonth && keyboard && sameDay(day, active)) ||
											undefined
										}
										data-preview-end={
											(inMonth && hollowKey === key) || undefined
										}
										onPointerEnter={() => !disabled && onPreview?.(day)}
										onClick={() => onSelect(day)}
									>
										{day.getDate()}
									</button>
								</div>
							);
						})}
					</div>
				))}
			</div>
		</section>
	);
}
