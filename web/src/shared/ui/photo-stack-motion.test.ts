import { describe, expect, it } from "vitest";
import {
	getDirectionalZ,
	getDragProgress,
	getStackSlot,
	interpolateSlot,
} from "./photo-stack-motion";

describe("PhotoStack motion decisions", () => {
	it("将拖动进度钳制在 0~1", () => {
		expect(getDragProgress(20, 80)).toBe(0.25);
		expect(getDragProgress(-200, 80)).toBe(1);
		expect(getDragProgress(10, 0)).toBe(1);
	});

	it("只把目标方向的后卡向前插槽联动", () => {
		const from = { x: 20, y: -8, rotate: 3, scale: 0.92 };
		const to = { x: 0, y: 0, rotate: 0, scale: 1 };
		expect(interpolateSlot(from, to, 0.5)).toEqual({
			x: 10,
			y: -4,
			rotate: 1.5,
			scale: 0.96,
		});
		expect(getDirectionalZ("right", "right", 1)).toBe(69);
		expect(getDirectionalZ("right", "left", 1)).toBe(29);
	});

	it("后层槽位向上缩进，底边不超过顶卡", () => {
		const slot = getStackSlot("right", 3, 280);
		expect(slot.y).toBe(-24);
		expect(slot.scale).toBe(0.88);
		expect(slot.rotate).toBe(4.5);
	});
});
