import { yearProgress } from "@shared/lib/year-progress";
import { describe, expect, it } from "vitest";

describe("yearProgress", () => {
	it("年初是第 1 天，当月是一月", () => {
		expect(yearProgress(new Date(2026, 0, 1, 8))).toEqual({
			year: 2026,
			dayOfYear: 1,
			daysLeft: 364,
			month: 0,
		});
	});

	it("年末最后一天还有 0 天", () => {
		expect(yearProgress(new Date(2026, 11, 31, 23, 59))).toEqual({
			year: 2026,
			dayOfYear: 365,
			daysLeft: 0,
			month: 11,
		});
	});

	it("设计稿的例子：10 月 31 日是第 304 天，还有 61 天", () => {
		expect(yearProgress(new Date(2026, 9, 31, 12))).toMatchObject({
			dayOfYear: 304,
			daysLeft: 61,
			month: 9,
		});
	});

	it("闰年多一天", () => {
		expect(yearProgress(new Date(2028, 11, 31))).toMatchObject({ dayOfYear: 366, daysLeft: 0 });
		expect(yearProgress(new Date(2028, 2, 1))).toMatchObject({ dayOfYear: 61 });
	});

	it("夏令时切换的日子也不会差一天", () => {
		// 以本地日历日计，不按 24 小时的毫秒数除
		const seen = new Set<number>();
		for (let day = 1; day <= 31; day++) {
			seen.add(yearProgress(new Date(2026, 2, day, 12)).dayOfYear);
		}
		expect(seen.size).toBe(31);
	});
});
