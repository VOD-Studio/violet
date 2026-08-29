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

	it("拖拽全行程顶卡渐渐缩小（从 1.0 连续缩至 0.896）", () => {
		const width = 200;
		// 1. 小拉出 (40px) -> 顶卡明显渐渐变小 (1.0 -> 0.983)
		const p1 = getDraggedTopSlot(-40, width, true);
		expect(p1.topSlot.scale).toBeCloseTo(1 - 0.104 * (40 / 240), 3);

		// 2. 中程拉出 (120px) -> 进一步渐渐变小 (0.948)
		const p2 = getDraggedTopSlot(-120, width, true);
		expect(p2.topSlot.scale).toBeCloseTo(1 - 0.104 * (120 / 240), 3);

		// 3. 拉出峰值 (160px) -> 持续变小 (0.931)
		const p3 = getDraggedTopSlot(-160, width, true);
		expect(p3.topSlot.scale).toBeCloseTo(1 - 0.104 * (160 / 240), 3);

		// 4. 充分拖拽完成插槽 (240px) -> 完全缩小到后槽尺寸 0.896
		const p4 = getDraggedTopSlot(-240, width, true);
		expect(p4.topSlot.scale).toBeCloseTo(0.896, 3);
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
	});

	it("后层槽位严格基于实测数据：X 偏移 0.106132w、Y 偏移 4px、scale 0.896、rotate 1.0°", () => {
		const slot = getStackSlot("right", 2, 280);
		expect(slot.x).toBeCloseTo(59.43, 1);
		expect(slot.y).toBe(8);
		expect(slot.scale).toBeCloseTo(0.792, 3);
		expect(slot.rotate).toBeCloseTo(2.0, 1);
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
