/** 某一天在所在年份里的位置。 */
export interface YearProgress {
	year: number;
	/** 第几天，1 月 1 日为 1 */
	dayOfYear: number;
	/** 距年底还有几天，12 月 31 日为 0 */
	daysLeft: number;
	/** 月份，0–11 */
	month: number;
}

const DAY_MS = 86_400_000;

/** 本地日历日的序号：用 UTC 重建同一年月日，避开夏令时让某天不足 24 小时。 */
function dayNumber(year: number, month: number, day: number): number {
	return Math.floor(Date.UTC(year, month, day) / DAY_MS);
}

/**
 * 按本地日历计算某一天在年内的位置。
 *
 * @param date - 要计算的时刻，取其本地年月日
 */
export function yearProgress(date: Date): YearProgress {
	const year = date.getFullYear();
	const today = dayNumber(year, date.getMonth(), date.getDate());
	const first = dayNumber(year, 0, 1);
	const last = dayNumber(year, 11, 31);
	return {
		year,
		dayOfYear: today - first + 1,
		daysLeft: last - today,
		month: date.getMonth(),
	};
}
