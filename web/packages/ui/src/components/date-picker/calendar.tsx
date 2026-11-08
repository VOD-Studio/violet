"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
	addDays,
	addMonths,
	formatPickerValue,
	fullDateName,
	sameDay,
	startOfMonth,
} from "./date-utils";

interface CalendarProps {
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
	previous?: boolean;
	next?: boolean;
}

export function Calendar({
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
	previous = true,
	next = true,
}: CalendarProps) {
	const today = new Date();
	const first = startOfMonth(month);
	const start = addDays(first, -((first.getDay() + 6) % 7));
	const rangeEnd = preview ?? range?.end;
	const rangeStart = range?.start;
	const lo =
		rangeStart && rangeEnd ? (rangeStart < rangeEnd ? rangeStart : rangeEnd) : rangeStart;
	const hi = rangeStart && rangeEnd ? (rangeStart < rangeEnd ? rangeEnd : rangeStart) : rangeEnd;
	const firstKey = lo && formatPickerValue(lo, "date");
	const lastKey = hi && formatPickerValue(hi, "date");
	return (
		<section
			className="v-date-picker__calendar"
			aria-label={`${month.getFullYear()} 年 ${month.getMonth() + 1} 月`}
		>
			<div className="v-date-picker__heading">
				<button
					type="button"
					tabIndex={-1}
					className="v-date-picker__nav"
					aria-label={months ? "上一年" : "上个月"}
					disabled={
						!previous ||
						(month.getFullYear() <= 1 && (months || month.getMonth() === 0))
					}
					data-hidden={!previous || undefined}
					onClick={() => onMonthChange(addMonths(month, months ? -12 : -1))}
				>
					<ChevronLeft aria-hidden />
				</button>
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
				<button
					type="button"
					tabIndex={-1}
					className="v-date-picker__nav"
					aria-label={months ? "下一年" : "下个月"}
					disabled={
						!next ||
						(month.getFullYear() >= 9999 && (months || month.getMonth() === 11))
					}
					data-hidden={!next || undefined}
					onClick={() => onMonthChange(addMonths(month, months ? 12 : 1))}
				>
					<ChevronRight aria-hidden />
				</button>
			</div>
			{months ? (
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
			) : (
				<div className="v-date-picker__days" key={formatPickerValue(first, "date")}>
					<div className="v-date-picker__week" aria-hidden>
						{["一", "二", "三", "四", "五", "六", "日"].map((day) => (
							<span key={day}>{day}</span>
						))}
					</div>
					<div
						role="grid"
						aria-label={`${month.getFullYear()} 年 ${month.getMonth() + 1} 月`}
						className="v-date-picker__grid"
						data-preview={preview ? "" : undefined}
						onPointerLeave={() => onPreview?.(null)}
					>
						{Array.from({ length: 6 }, (_, week) => (
							<div role="row" tabIndex={-1} className="v-date-picker__row" key={week}>
								{Array.from({ length: 7 }, (_, weekday) => {
									const day = addDays(start, week * 7 + weekday);
									const key = formatPickerValue(day, "date");
									const inMonth = day.getMonth() === month.getMonth();
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
												aria-current={
													sameDay(day, today) ? "date" : undefined
												}
												disabled={disabled}
												className="v-date-picker__day"
												data-outside={!inMonth || undefined}
												data-today={
													(inMonth && sameDay(day, today)) || undefined
												}
												data-selected={pressed || undefined}
												data-active={
													(inMonth && keyboard && sameDay(day, active)) ||
													undefined
												}
												data-start={
													(inMonth &&
														firstKey === key &&
														lastKey !== key) ||
													undefined
												}
												data-end={
													(inMonth &&
														lastKey === key &&
														firstKey !== key) ||
													undefined
												}
												data-middle={
													(inMonth &&
														firstKey &&
														lastKey &&
														key > firstKey &&
														key < lastKey) ||
													undefined
												}
												data-preview-end={
													(inMonth &&
														preview &&
														sameDay(day, preview) &&
														!sameDay(day, range?.start)) ||
													undefined
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
				</div>
			)}
		</section>
	);
}
