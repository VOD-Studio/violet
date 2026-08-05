import { resolveTransitionOrigin } from "@shared/ui/theme-transition";
import { describe, expect, it } from "vitest";

describe("resolveTransitionOrigin", () => {
	// 选 clientX/Y 使百分比落在整数：120/1000=12%, 90/600=15%
	it("uses the click coordinates when provided", () => {
		const ev = { clientX: 120, clientY: 90 } as MouseEvent;
		expect(resolveTransitionOrigin(ev, { w: 1000, h: 600 })).toEqual({
			x: 12,
			y: 15,
		});
	});

	it("falls back to viewport center when clientX/Y missing", () => {
		const ev = {} as MouseEvent;
		expect(resolveTransitionOrigin(ev, { w: 1000, h: 600 })).toEqual({
			x: 50,
			y: 50,
		});
	});

	it("clamps within 0..100 percent", () => {
		const ev = { clientX: -50, clientY: 9999 } as MouseEvent;
		expect(resolveTransitionOrigin(ev, { w: 1000, h: 600 })).toEqual({
			x: 0,
			y: 100,
		});
	});
});
