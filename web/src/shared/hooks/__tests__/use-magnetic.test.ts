import { computeMagnetic } from "@shared/hooks/use-magnetic";
import { describe, expect, it } from "vitest";

describe("computeMagnetic", () => {
	it("pulls toward the cursor by strength", () => {
		const off = computeMagnetic({
			clientX: 120,
			clientY: 80,
			cx: 100,
			cy: 100,
			strength: 0.25,
		});
		expect(off).toEqual({ dx: 5, dy: -5 });
	});

	it("zero offset when cursor is at center", () => {
		const off = computeMagnetic({
			clientX: 50,
			clientY: 50,
			cx: 50,
			cy: 50,
		});
		expect(off).toEqual({ dx: 0, dy: 0 });
	});

	it("respects default strength 0.25", () => {
		const off = computeMagnetic({
			clientX: 200,
			clientY: 200,
			cx: 100,
			cy: 100,
		});
		expect(off).toEqual({ dx: 25, dy: 25 });
	});
});
