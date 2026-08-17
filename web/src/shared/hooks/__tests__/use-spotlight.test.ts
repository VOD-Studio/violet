import { computeSpotlight } from "@shared/hooks/use-spotlight";
import { describe, expect, it } from "vitest";

describe("computeSpotlight", () => {
	const rect = { left: 100, top: 50, width: 400, height: 200 };

	it("returns raw delta when inside", () => {
		expect(computeSpotlight({ clientX: 300, clientY: 150 }, rect)).toEqual({
			x: 200,
			y: 100,
		});
	});

	it("clamps to top-left edge when outside", () => {
		expect(computeSpotlight({ clientX: 0, clientY: 0 }, rect)).toEqual({
			x: 0,
			y: 0,
		});
	});

	it("clamps to bottom-right edge when outside", () => {
		expect(computeSpotlight({ clientX: 9999, clientY: 9999 }, rect)).toEqual({
			x: 400,
			y: 200,
		});
	});
});
