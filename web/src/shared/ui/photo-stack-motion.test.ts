import { motionValue } from "motion/react";
import { describe, expect, it } from "vitest";
import {
	cardMotionKey,
	getBoundaryFollowerSlot,
	getDirectionalZ,
	getDraggedTopSlot,
	getDragProgress,
	getStackSlot,
	interpolateSlot,
	recentVelocity,
	resetMotionValueVelocity,
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

	it("0、半阈值与完整阈值的缩放及 Y/Z 双轴旋转连续单调", () => {
		const start = getDraggedTopSlot(0, 200, true);
		const halfway = getDraggedTopSlot(80, 200, true);
		const threshold = getDraggedTopSlot(160, 200, true);

		expect(start.topSlot.scale).toBe(1);
		expect(halfway.topSlot.scale).toBeCloseTo(0.948, 3);
		expect(threshold.topSlot.scale).toBeCloseTo(0.896, 3);
		expect(start.topSlot.scale).toBeGreaterThan(halfway.topSlot.scale);
		expect(halfway.topSlot.scale).toBeGreaterThan(threshold.topSlot.scale);

		expect(start.topSlot.rotate).toBe(0);
		expect(halfway.topSlot.rotate).toBeCloseTo(5.5, 3);
		expect(threshold.topSlot.rotate).toBeCloseTo(11, 3);
		expect(start.topSlot.rotate).toBeLessThan(halfway.topSlot.rotate);
		expect(halfway.topSlot.rotate).toBeLessThan(threshold.topSlot.rotate);

		expect(start.rotateY).toBe(0);
		expect(halfway.rotateY).toBeCloseTo(1, 3);
		expect(threshold.rotateY).toBeCloseTo(2, 3);
		expect(start.rotateY).toBeLessThan(halfway.rotateY);
		expect(halfway.rotateY).toBeLessThan(threshold.rotateY);
		expect(threshold.rotateY).toBeLessThan(threshold.topSlot.rotate);
	});

	it("左右拖拽产生同号镜像的 Y/Z 双轴旋转", () => {
		const left = getDraggedTopSlot(-160, 200, true);
		const right = getDraggedTopSlot(160, 200, true);
		expect(left.topSlot.scale).toBeCloseTo(right.topSlot.scale, 3);
		expect(left.topSlot.rotate).toBeCloseTo(-11, 3);
		expect(right.topSlot.rotate).toBeCloseTo(11, 3);
		expect(left.rotateY).toBeCloseTo(-2, 3);
		expect(right.rotateY).toBeCloseTo(2, 3);
		expect(left.topSlot.rotate).toBeCloseTo(-right.topSlot.rotate, 3);
		expect(left.rotateY).toBeCloseTo(-right.rotateY, 3);
	});

	it("不同宽度均在各自拉出阈值封顶", () => {
		const wide = getDraggedTopSlot(400, 500, true);
		expect(wide.topSlot.rotate).toBe(11);
		expect(wide.rotateY).toBe(2);
	});

	it("有效方向保留既有两阶段插槽轨迹", () => {
		const peak = getDraggedTopSlot(-224, 280, true);
		const inserting = getDraggedTopSlot(-280, 280, true);
		const rear = getDraggedTopSlot(-336, 280, true);

		expect(peak.topSlot.x).toBe(-224);
		expect(peak.isPastThreshold).toBe(true);
		expect(inserting.topSlot.x).toBeCloseTo(-126.85848, 5);
		expect(rear.topSlot.x).toBeCloseTo(-29.71696, 5);
	});

	it("边界顶卡按受限位移进度旋转和轻微放大", () => {
		const halfway = getDraggedTopSlot(72, 400, false);
		const capped = getDraggedTopSlot(144, 400, false);
		const large = getDraggedTopSlot(320, 400, false);
		const mirrored = getDraggedTopSlot(-320, 400, false);

		expect.soft(halfway.topSlot.x).toBeCloseTo(16, 5);
		expect.soft(halfway.topSlot.y).toBe(0);
		expect.soft(halfway.topSlot.rotate).toBeCloseTo(1.6, 5);
		expect.soft(halfway.topSlot.scale).toBeCloseTo(1.00515, 5);
		expect.soft(halfway.rotateY).toBe(0);

		expect.soft(large.topSlot.x).toBeCloseTo(32, 5);
		expect.soft(large.topSlot.y).toBe(0);
		expect.soft(large.topSlot.rotate).toBeCloseTo(3.2, 5);
		expect.soft(large.topSlot.scale).toBeCloseTo(1.0103, 5);
		expect.soft(large.rotateY).toBe(0);
		expect.soft(capped.topSlot.x).toBeCloseTo(large.topSlot.x, 0);
		expect.soft(capped.topSlot.rotate).toBeCloseTo(large.topSlot.rotate, 1);
		expect.soft(capped.topSlot.scale).toBeCloseTo(large.topSlot.scale, 3);

		expect.soft(mirrored.topSlot.x).toBeCloseTo(-large.topSlot.x, 5);
		expect.soft(mirrored.topSlot.rotate).toBeCloseTo(-large.topSlot.rotate, 5);
		expect.soft(mirrored.topSlot.y).toBe(large.topSlot.y);
		expect.soft(mirrored.topSlot.scale).toBeCloseTo(large.topSlot.scale, 5);
		expect.soft(mirrored.rotateY).toBe(0);
	});

	it("边界后卡按深度跟随顶卡且保留自身槽位几何", () => {
		const base = { x: 30, y: 4, rotate: 1, scale: 0.896 };
		const depth1 = getBoundaryFollowerSlot(base, 32, 1);
		const depth2 = getBoundaryFollowerSlot(base, 32, 2);
		const depth3 = getBoundaryFollowerSlot(base, 32, 3);
		expect(depth1.x - base.x).toBeCloseTo(32 * 0.66, 5);
		expect(depth2.x - base.x).toBeCloseTo(32 * 0.37, 5);
		expect(depth3.x - base.x).toBeCloseTo(32 * 0.08, 5);
		expect(depth1).toMatchObject({ y: base.y, rotate: base.rotate, scale: base.scale });
		expect(depth2).toMatchObject({ y: base.y, rotate: base.rotate, scale: base.scale });
		expect(depth3).toMatchObject({ y: base.y, rotate: base.rotate, scale: base.scale });
	});

	it("边界回弹前保持当前位置并清零拖动速度", () => {
		const value = motionValue(0);
		value.setWithVelocity(0, -25.46, 16);
		expect(value.getVelocity()).toBeLessThan(0);

		resetMotionValueVelocity(value);

		expect(value.get()).toBe(-25.46);
		expect(value.getVelocity()).toBe(0);
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

	it("同位置短暂停后仍取最近有效速度，长停后速度归零", () => {
		const samples = [
			{ t: 300, x: 170 },
			{ t: 360, x: 140 },
		];
		expect(recentVelocity(samples, 100, 430)).toBe(-0.5);
		expect(recentVelocity(samples, 100, 461)).toBe(0);
	});
});
