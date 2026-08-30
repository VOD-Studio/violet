import { describe, expect, it } from "vitest";
import {
	getDraggedTopSlot,
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
	it("只有拖拽超出阈值时目标卡才升至顶层，未达阈值前当前卡保持置顶", () => {
		expect(getDirectionalZ("right", "right", 1, false)).toBe(69);
		expect(getDirectionalZ("right", "right", 1, true)).toBe(100);
		expect(getDirectionalZ("right", "left", 1, true)).toBe(29);
		expect(getDirectionalZ(null, "right", 1, false)).toBe(29);
	});

	it("左右拖拽产生镜像的 rotateY、rotateZ，并保留行程缩放", () => {
		const left = getDraggedTopSlot(-120, 200, true);
		const right = getDraggedTopSlot(120, 200, true);
		expect(left.topSlot.scale).toBeCloseTo(0.922, 3);
		expect(right.topSlot.scale).toBeCloseTo(0.922, 3);
		expect(left.rotateY).toBeLessThan(0);
		expect(right.rotateY).toBeGreaterThan(0);
		expect(left.rotateY).toBeCloseTo(-right.rotateY, 3);
		expect(left.topSlot.rotate).toBeLessThan(0);
		expect(right.topSlot.rotate).toBeGreaterThan(0);
		expect(left.topSlot.rotate).toBeCloseTo(-right.topSlot.rotate, 3);
	});
	it("rotateY 随拖动距离增长并封顶，边界阻尼时仍保留缩小与倾斜", () => {
		const near = getDraggedTopSlot(40, 200, true);
		const far = getDraggedTopSlot(400, 200, true);
		const boundary = getDraggedTopSlot(120, 200, false);
		expect(Math.abs(near.rotateY)).toBeLessThan(Math.abs(far.rotateY));
		expect(far.rotateY).toBe(12);
		expect(getDraggedTopSlot(0, 200, true).rotateY).toBe(0);
		expect(boundary.topSlot.scale).toBeCloseTo(0.922, 3);
		expect(boundary.topSlot.rotate).toBeGreaterThan(0);
		expect(boundary.rotateY).toBeGreaterThan(0);
	});
	it("插值时保留现有几何", () => {
		const from = { x: 20, y: -8, rotate: 3, scale: 0.92 };
		const to = { x: 0, y: 0, rotate: 0, scale: 1 };
		expect(interpolateSlot(from, to, 0.5)).toEqual({
			x: 10,
			y: -4,
			rotate: 1.5,
			scale: 0.96,
		});
	});

	it("后层槽位按宽度缩放并保留静态旋转", () => {
		const slot = getStackSlot("right", 2, 280);
		expect(slot.x).toBeCloseTo(59.43, 1);
		expect(slot.y).toBe(8);
		expect(slot.scale).toBeCloseTo(0.792, 3);
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
