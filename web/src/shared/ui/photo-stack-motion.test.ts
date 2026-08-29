import { describe, expect, it } from "vitest";
import {
	cardMotionKey,
	getDirectionalZ,
	getDragProgress,
	getStackSlot,
	interpolateSlot,
	recentVelocity,
	shouldFlip,
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

	it("卡片身份不随顶卡与后置卡角色改变", () => {
		expect(cardMotionKey("/one.jpg", 0)).toBe("/one.jpg-0");
		expect(cardMotionKey("/one.jpg", 0)).toBe(cardMotionKey("/one.jpg", 0));
		expect(cardMotionKey("/one.jpg", 0)).not.toBe(cardMotionKey("/one.jpg", 1));
	});

	it("快速轻扫达到速度阈值即翻页，慢拖不足距离则回弹", () => {
		expect(shouldFlip(30, 0.8, 39.2, true)).toBe(true);
		expect(shouldFlip(60, 0, 39.2, true)).toBe(true);
		expect(shouldFlip(30, 0.2, 39.2, true)).toBe(false);
		expect(shouldFlip(10, 5, 39.2, true)).toBe(false);
	});

	it("轻扫速度方向与位移相反时不翻页", () => {
		expect(shouldFlip(-30, 0.8, 39.2, true)).toBe(false);
		expect(shouldFlip(-30, -0.8, 39.2, true)).toBe(true);
		expect(shouldFlip(30, 0.8, 39.2, false)).toBe(false);
	});

	it("速度取窗口期样本，时间戳无进展时为零", () => {
		expect(
			recentVelocity([
				{ t: 0, x: 0 },
				{ t: 100, x: 50 },
			]),
		).toBe(0.5);
		expect(
			recentVelocity(
				[
					{ t: 0, x: 0 },
					{ t: 500, x: 0 },
					{ t: 520, x: -20 },
					{ t: 540, x: -40 },
				],
				100,
			),
		).toBe(-1);
		expect(recentVelocity([{ t: 5, x: 30 }])).toBe(0);
		expect(
			recentVelocity([
				{ t: 5, x: 30 },
				{ t: 5, x: 40 },
			]),
		).toBe(0);
	});
});
