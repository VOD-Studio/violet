import { afterEach, describe, expect, it, vi } from "vitest";
import {
	formatDate,
	formatDateTime,
	formatMessageTime,
	formatRelativeTime,
	formatTime,
} from "../date";

describe("date display formatting", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("uses the shared absolute-date styles", () => {
		expect(formatDate("2026-09-07")).toBe("2026-09-07");
		expect(formatDate("2026-09-07", "dotted-date")).toBe("2026.09.07");
		expect(formatDate("2026-09-07", "slash-date")).toBe("2026/9/7");
		expect(formatDate("2026-09-07", "long-date")).toBe("2026年9月7日");
		expect(formatDate("2026-09-07", "month")).toBe("9月");
		expect(formatDate("2026-09-07", "year")).toBe("2026年");
	});

	it("uses the publication timezone across the UTC calendar boundary", () => {
		const instant = "2026-09-07T23:29:41Z";
		expect(formatDate(instant, "long-date", "—", "Asia/Shanghai")).toBe("2026年9月8日");
		expect(formatDate(instant, "long-date", "—", "UTC")).toBe("2026年9月7日");
		expect(formatDate("2026-09-07", "long-date", "—", "Asia/Shanghai")).toBe("2026年9月7日");
		expect(formatDate("invalid", "long-date", "—", "Asia/Shanghai")).toBe("—");
	});

	it("uses the shared date-time precision", () => {
		const value = new Date(2026, 8, 7, 9, 5, 4);

		expect(formatDateTime(value)).toBe("2026-09-07 09:05");
		expect(formatDateTime(value, "second")).toBe("2026-09-07 09:05:04");
		expect(formatTime(value)).toBe("09:05");
		expect(formatTime(value, "second")).toBe("09:05:04");
	});

	it("returns the caller fallback for invalid input", () => {
		expect(formatDate("not-a-date")).toBe("not-a-date");
		expect(formatDate("not-a-date", "iso-date", "—")).toBe("—");
		expect(formatRelativeTime("not-a-date", "刚刚")).toBe("刚刚");
		expect(formatDateTime(undefined, "second", "—")).toBe("—");
	});

	it("uses one Chinese relative-time convention", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-09-07T12:00:00Z"));

		expect(formatRelativeTime("2026-09-07T11:55:00Z")).toBe("5 分钟前");
	});
});

describe("formatMessageTime", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	const at = (day: number, hour: number, minute = 0, second = 0) =>
		new Date(2026, 10, day, hour, minute, second);

	it("当天按分钟与小时数，隔天起按日历日数而不是满 24 小时", () => {
		vi.useFakeTimers();
		vi.setSystemTime(at(9, 10));
		expect(formatMessageTime(at(9, 9, 59, 40))).toBe("刚刚");
		expect(formatMessageTime(at(9, 9, 2))).toBe("58 分钟前");
		expect(formatMessageTime(at(9, 7))).toBe("3 小时前");
		expect(formatMessageTime(at(8, 23))).toBe("昨天");
		expect(formatMessageTime(at(7, 20))).toBe("前天");
		expect(formatMessageTime(at(6, 20))).toBe("3 天前");
		expect(formatMessageTime(at(3, 8))).toBe("6 天前");
	});

	it("满一周显示月日；时钟略快造成的未来时间按刚刚；无效输入用兜底", () => {
		vi.useFakeTimers();
		vi.setSystemTime(at(9, 10));
		expect(formatMessageTime(at(2, 8))).toBe("11月2日");
		expect(formatMessageTime(at(9, 10, 0, 30))).toBe("刚刚");
		expect(formatMessageTime("not-a-date", "—")).toBe("—");
	});
});
