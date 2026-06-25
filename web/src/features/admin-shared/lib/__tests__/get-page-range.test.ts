import { describe, expect, it } from "vitest";
import { getPageRange } from "../get-page-range";

describe("getPageRange", () => {
	it("总页 0 返回空数组", () => {
		expect(getPageRange(1, 0)).toEqual([]);
	});

	it("总页 1 返回 [1]", () => {
		expect(getPageRange(1, 1)).toEqual([1]);
	});

	it("总页 5 current 3 全展开", () => {
		expect(getPageRange(3, 5)).toEqual([1, 2, 3, 4, 5]);
	});

	it("总页 10 current 5 居中", () => {
		expect(getPageRange(5, 10)).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 10]);
	});

	it("总页 10 current 1 居首", () => {
		expect(getPageRange(1, 10)).toEqual([1, 2, "ellipsis", 10]);
	});

	it("总页 10 current 10 居末", () => {
		expect(getPageRange(10, 10)).toEqual([1, "ellipsis", 9, 10]);
	});

	it("current 越界 999 等价于 current=10", () => {
		expect(getPageRange(999, 10)).toEqual([1, "ellipsis", 9, 10]);
	});

	it("结果无相邻 ellipsis", () => {
		const ranges = [
			getPageRange(1, 10),
			getPageRange(5, 10),
			getPageRange(10, 10),
			getPageRange(3, 7),
			getPageRange(7, 20, 2),
		];
		ranges.forEach((range) => {
			for (let i = 0; i < range.length - 1; i++) {
				expect(range[i] !== "ellipsis" || range[i + 1] !== "ellipsis").toBe(true);
			}
		});
	});

	it("结果无重复页码", () => {
		const ranges = [
			getPageRange(1, 10),
			getPageRange(5, 10),
			getPageRange(10, 10),
			getPageRange(3, 100, 2),
		];
		ranges.forEach((range) => {
			const nums = range.filter((x): x is number => typeof x === "number");
			expect(new Set(nums).size).toBe(nums.length);
		});
	});
});
