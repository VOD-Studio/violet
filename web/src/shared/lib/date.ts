import { format, formatDistanceToNow, isValid, parseISO, toDate } from "date-fns";
import { zhCN } from "date-fns/locale";

type DateDisplayStyle =
	| "iso-date"
	| "dotted-date"
	| "slash-date"
	| "long-date"
	| "month-day"
	| "dotted-month-day"
	| "long-month-day"
	| "month"
	| "month-name"
	| "year"
	| "weekday-date"
	| "year-month";
type DateTimeDisplayStyle =
	| "minute"
	| "second"
	| "short-minute"
	| "short-second"
	| "long-minute"
	| "long";
type TimeDisplayPrecision = "minute" | "second";
type DateInput = Date | number | string | null | undefined;

const DATE_FORMATS: Record<DateDisplayStyle, string> = {
	"iso-date": "yyyy-MM-dd",
	"dotted-date": "yyyy.MM.dd",
	"slash-date": "yyyy/M/d",
	"long-date": "yyyy年M月d日",
	"month-day": "MM-dd",
	"dotted-month-day": "MM·dd",
	"long-month-day": "M月d日",
	"month-name": "MMMM",
	month: "M月",
	"weekday-date": "yyyy年MM月dd日 EEEE",
	year: "yyyy年",
	"year-month": "yyyy年M月",
};

const DATE_TIME_FORMATS: Record<DateTimeDisplayStyle, string> = {
	minute: "yyyy-MM-dd HH:mm",
	second: "yyyy-MM-dd HH:mm:ss",
	"short-minute": "MM-dd HH:mm",
	"short-second": "MM-dd HH:mm:ss",
	"long-minute": "PPPp",
	long: "PPPpp",
};

const TIME_FORMATS: Record<TimeDisplayPrecision, string> = {
	minute: "HH:mm",
	second: "HH:mm:ss",
};

function formatPattern(value: DateInput, pattern: string, fallback: string): string {
	if (value == null) return fallback;
	const date = typeof value === "string" ? parseISO(value) : toDate(value);
	return isValid(date) ? format(date, pattern, { locale: zhCN }) : fallback;
}

/**
 * 按站点约定格式化绝对日期。
 *
 * @param value - Date、时间戳、ISO 8601 字符串或空值。
 * @param style - 固定展示形态，默认 `yyyy-MM-dd`。
 * @param fallback - 无效输入的返回值；默认保留字符串输入，否则显示破折号。
 * @param timeZone - 显式 IANA 时区；SSR 与浏览器应传相同值。纯日期字符串保留日历日期。
 * @returns 格式化后的日期，或无效输入的兜底值。
 */
export function formatDate(
	value: DateInput,
	style: DateDisplayStyle = "iso-date",
	fallback = typeof value === "string" ? value : "—",
	timeZone?: string,
): string {
	if (!timeZone || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))) {
		return formatPattern(value, DATE_FORMATS[style], fallback);
	}
	if (value == null) return fallback;
	const date = typeof value === "string" ? parseISO(value) : toDate(value);
	if (!isValid(date)) return fallback;
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(date);
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((entry) => entry.type === type)?.value;
	return formatPattern(
		`${part("year")}-${part("month")}-${part("day")}`,
		DATE_FORMATS[style],
		fallback,
	);
}

/**
 * 按站点约定格式化日期时间。
 *
 * @param value - Date、时间戳、ISO 8601 字符串或空值。
 * @param style - 分钟、秒、短日期或中文完整日期时间。
 * @param fallback - 无效输入的返回值；默认保留字符串输入，否则显示破折号。
 * @returns 格式化后的本地日期时间，或无效输入的兜底值。
 */
export function formatDateTime(
	value: DateInput,
	style: DateTimeDisplayStyle = "minute",
	fallback = typeof value === "string" ? value : "—",
): string {
	return formatPattern(value, DATE_TIME_FORMATS[style], fallback);
}

/**
 * 按站点约定格式化一天内的时间。
 *
 * @param value - Date、时间戳、ISO 8601 字符串或空值。
 * @param precision - 是否显示秒。
 * @param fallback - 无效输入的返回值；默认保留字符串输入，否则显示破折号。
 * @returns 格式化后的本地时间，或无效输入的兜底值。
 */
export function formatTime(
	value: DateInput,
	precision: TimeDisplayPrecision = "minute",
	fallback = typeof value === "string" ? value : "—",
): string {
	return formatPattern(value, TIME_FORMATS[precision], fallback);
}

/**
 * 以中文显示距离当前时间的相对时长。
 *
 * @param value - Date、时间戳、ISO 8601 字符串或空值。
 * @param fallback - 无效输入的返回值；默认保留字符串输入，否则显示破折号。
 * @returns 带过去或未来后缀的相对时间，或无效输入的兜底值。
 */
export function formatRelativeTime(
	value: DateInput,
	fallback = typeof value === "string" ? value : "—",
): string {
	if (value == null) return fallback;
	const date = typeof value === "string" ? parseISO(value) : toDate(value);
	return isValid(date) ? formatDistanceToNow(date, { addSuffix: true, locale: zhCN }) : fallback;
}
