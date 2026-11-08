import type { DatePickerMode, DateRange, DateRangePreset } from "./types";

const pad = (value: number) => String(value).padStart(2, "0");

/** 严格解析本地日期；拒绝溢出日期、混合分隔符与不存在的本地时刻。 */
export function parsePickerValue(value: string, mode: DatePickerMode): Date | null {
	const raw = value.trim();
	const match =
		mode === "time"
			? /^(\d{1,2}):(\d{2})$/.exec(raw)
			: /^(\d{4})([-/.])(\d{1,2})\2(\d{1,2})(?:[T ](\d{1,2}):(\d{2}))?$/.exec(raw);
	if (!match) return null;
	const year = mode === "time" ? 2000 : Number(match[1]);
	const month = mode === "time" ? 1 : Number(match[3]);
	const day = mode === "time" ? 1 : Number(match[4]);
	const hour = Number(mode === "time" ? match[1] : (match[5] ?? 0));
	const minute = Number(mode === "time" ? match[2] : (match[6] ?? 0));
	if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59)
		return null;
	if (mode === "date" && match[5] !== undefined) return null;
	if (mode === "datetime" && match[5] === undefined) return null;
	const date = new Date(2000, month - 1, day, hour, minute);
	date.setFullYear(year);
	if (
		date.getFullYear() !== year ||
		date.getMonth() !== month - 1 ||
		date.getDate() !== day ||
		date.getHours() !== hour ||
		date.getMinutes() !== minute
	)
		return null;
	return date;
}

/** 输出 YYYY-MM-DD、YYYY-MM-DDTHH:mm 或 HH:mm。 */
export function formatPickerValue(date: Date, mode: DatePickerMode): string {
	const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
	if (mode === "time") return time;
	const day = `${String(date.getFullYear()).padStart(4, "0")}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
	return mode === "date" ? day : `${day}T${time}`;
}

export function startOfMonth(date: Date) {
	const next = new Date(date);
	next.setDate(1);
	next.setHours(0, 0, 0, 0);
	return next;
}

export function addDays(date: Date, days: number) {
	const next = new Date(date);
	next.setDate(next.getDate() + days);
	return next;
}

export function addMonths(date: Date, months: number) {
	const next = new Date(date);
	const day = next.getDate();
	next.setDate(1);
	next.setMonth(next.getMonth() + months);
	const last = new Date(next);
	last.setMonth(last.getMonth() + 1, 0);
	next.setDate(Math.min(day, last.getDate()));
	return next;
}

export function sameDay(a: Date | null | undefined, b: Date | null | undefined) {
	return (
		!!a &&
		!!b &&
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

export function fullDateName(date: Date) {
	return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日 星期${"日一二三四五六"[date.getDay()]}`;
}

export interface DateConstraints {
	mode: DatePickerMode;
	min?: string;
	max?: string;
	disabledDate?: (date: Date) => boolean;
}

export function isAllowed(
	date: Date,
	{ mode, min, max, disabledDate }: DateConstraints,
	dayOnly = false,
) {
	const value = formatPickerValue(date, dayOnly ? "date" : mode);
	const lower = min && parsePickerValue(min, mode);
	const upper = max && parsePickerValue(max, mode);
	if (lower && value < formatPickerValue(lower, dayOnly ? "date" : mode)) return false;
	if (upper && value > formatPickerValue(upper, dayOnly ? "date" : mode)) return false;
	return mode === "time" || !disabledDate?.(date);
}

export function withDate(day: Date, value: string, mode: DatePickerMode) {
	const date = new Date(day);
	const current = parsePickerValue(value, mode);
	date.setHours(current?.getHours() ?? 0, current?.getMinutes() ?? 0, 0, 0);
	return date;
}

export function orderRange(range: DateRange): DateRange {
	return range.start && range.end && range.start > range.end
		? { start: range.end, end: range.start }
		: range;
}

export function rangePresets(mode: "date" | "datetime", today = new Date()): DateRangePreset[] {
	const first = startOfMonth(today);
	const previous = addMonths(first, -1);
	const end = addDays(addMonths(first, 1), -1);
	const pair = (start: Date, finish: Date): DateRange => {
		start.setHours(0, 0, 0, 0);
		finish.setHours(23, 59, 0, 0);
		return { start: formatPickerValue(start, mode), end: formatPickerValue(finish, mode) };
	};
	return [
		{ label: "今天", value: pair(new Date(today), new Date(today)) },
		{ label: "最近 7 天", value: pair(addDays(today, -6), new Date(today)) },
		{ label: "最近 30 天", value: pair(addDays(today, -29), new Date(today)) },
		{ label: "本月", value: pair(first, end) },
		{ label: "上个月", value: pair(previous, addDays(startOfMonth(today), -1)) },
	];
}
