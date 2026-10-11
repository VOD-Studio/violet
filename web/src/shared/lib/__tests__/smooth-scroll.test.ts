import { describe, expect, it } from "vitest";

import { easeInOutCubic, smoothScrollDuration } from "../smooth-scroll";

describe("easeInOutCubic", () => {
	it("起点、中点与终点分别为 0、0.5、1 且单调递增", () => {
		expect(easeInOutCubic(0)).toBe(0);
		expect(easeInOutCubic(0.5)).toBe(0.5);
		expect(easeInOutCubic(1)).toBe(1);
		expect(easeInOutCubic(0.25)).toBeLessThan(easeInOutCubic(0.75));
	});
});

describe("smoothScrollDuration", () => {
	it("近距离不低于下限，远距离不超过上限，且随距离增长", () => {
		expect(smoothScrollDuration(0)).toBe(380);
		expect(smoothScrollDuration(400)).toBeLessThan(smoothScrollDuration(4000));
		expect(smoothScrollDuration(1_000_000)).toBe(1000);
		expect(smoothScrollDuration(-900)).toBe(smoothScrollDuration(900));
	});
});
