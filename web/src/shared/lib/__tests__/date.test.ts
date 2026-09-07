import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDate, formatDateTime, formatRelativeTime, formatTime } from "../date";

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
