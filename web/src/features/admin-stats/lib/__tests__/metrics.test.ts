import { describe, expect, it } from "vitest";
import { computeDelta, formatCompact, nextMilestone } from "../metrics";

describe("computeDelta", () => {
	it("正增长给 up + 百分比", () => {
		expect(computeDelta(120, 100)).toEqual({ direction: "up", percent: 20 });
	});

	it("下降给 down + 百分比", () => {
		expect(computeDelta(80, 100)).toEqual({ direction: "down", percent: 20 });
	});

	it("持平给 flat 0", () => {
		expect(computeDelta(100, 100)).toEqual({ direction: "flat", percent: 0 });
	});

	it("基数为 0 返回 null（首日无对比）", () => {
		expect(computeDelta(5, 0)).toBeNull();
	});

	it("两期均为 0 返回 null", () => {
		expect(computeDelta(0, 0)).toBeNull();
	});

	it("负基数返回 null（脏数据防御）", () => {
		expect(computeDelta(5, -1)).toBeNull();
	});

	it("百分比保留一位小数", () => {
		expect(computeDelta(113, 100)?.percent).toBe(13);
		expect(computeDelta(111, 100)?.percent).toBe(11);
	});
});

describe("nextMilestone", () => {
	it("0 落在 1k 档", () => {
		expect(nextMilestone(0)).toEqual({ target: 1000, remaining: 1000, progress: 0 });
	});

	it("999 差 1 到 1k", () => {
		expect(nextMilestone(999)).toEqual({ target: 1000, remaining: 1, progress: 0.999 });
	});

	it("恰好落在刻度上跳到下一档（1000 → 5k）", () => {
		expect(nextMilestone(1000)).toEqual({ target: 5000, remaining: 4000, progress: 0.2 });
	});

	it("4999 差 1 到 5k", () => {
		expect(nextMilestone(4999)).toEqual({ target: 5000, remaining: 1, progress: 0.9998 });
	});

	it("5000 跳到 10k", () => {
		expect(nextMilestone(5000)).toEqual({ target: 10000, remaining: 5000, progress: 0.5 });
	});

	it("96700 落在 10w 档", () => {
		expect(nextMilestone(96700)).toEqual({ target: 100000, remaining: 3300, progress: 0.967 });
	});

	it("负数按 0 处理", () => {
		expect(nextMilestone(-5)).toEqual({ target: 1000, remaining: 1000, progress: 0 });
	});
});

describe("formatCompact", () => {
	it("千位以下原样输出", () => {
		expect(formatCompact(999)).toBe("999");
	});

	it("千位以上压缩", () => {
		expect(formatCompact(1200)).toBe("1200");
		expect(formatCompact(15000)).toBe("1.5万");
	});
});
