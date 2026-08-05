import { format, parse } from "date-fns";
import type { DateTimePickerMode } from "../types/date-time-picker-types";

/**
 * 根据 mode 获取解析格式模板
 * - date: YYYY-MM-DD
 * - datetime: YYYY-MM-DDTHH:mm
 * - time: HH:mm
 */
function getParseFormat(mode: DateTimePickerMode): string {
	switch (mode) {
		case "date":
			return "yyyy-MM-dd";
		case "time":
			return "HH:mm";
		default:
			return "yyyy-MM-dd'T'HH:mm";
	}
}

/**
 * 将字符串值解析为 Date 对象
 * @param value 当前值
 * @param mode 选择器模式
 * @returns 解析后的 Date，无效时返回 null
 */
export function parsePickerValue(value: string, mode: DateTimePickerMode): Date | null {
	if (!value) return null;
	const parsed = parse(value, getParseFormat(mode), new Date());
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * 将 Date 对象格式化为与 mode 对应的字符串
 * @param date 日期对象
 * @param mode 选择器模式
 */
export function formatPickerValue(date: Date, mode: DateTimePickerMode): string {
	return format(date, getParseFormat(mode));
}

/**
 * 将 datetime-local 字符串按模式拆分为日期部分和时间部分
 * @param value 当前值
 * @param mode 选择器模式
 */
export function splitDateTime(
	value: string,
	mode: DateTimePickerMode,
): { date: Date | null; time: string } {
	const date = parsePickerValue(value, mode);
	if (!date) return { date: null, time: "" };

	if (mode === "date") {
		return { date, time: "" };
	}

	const time = format(date, "HH:mm");
	return { date: mode === "time" ? null : date, time };
}

/**
 * 合并日期和时间字符串为 datetime-local 格式
 * @param date 日期部分（YYYY-MM-DD）
 * @param time 时间部分（HH:mm）
 */
export function combineDateTime(date: string, time: string): string {
	if (!date) return "";
	if (!time) return `${date}T00:00`;
	return `${date}T${time}`;
}

/**
 * 判断日期是否被禁用
 * @param date 待判断日期
 * @param options 禁用规则
 */
export function isDateDisabled(
	date: Date,
	options?: {
		minDate?: Date;
		maxDate?: Date;
		disabledDate?: (date: Date) => boolean;
	},
): boolean {
	const { minDate, maxDate, disabledDate } = options ?? {};
	if (minDate && date < minDate) return true;
	if (maxDate && date > maxDate) return true;
	if (disabledDate?.(date)) return true;
	return false;
}

/**
 * 将 Date 对象时间部分格式化为 HH:mm
 * @param date 日期对象
 */
export function formatTime(date: Date): string {
	return format(date, "HH:mm");
}
