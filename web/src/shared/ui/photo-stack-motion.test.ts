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

	it("两阶段拖拽：前半程 1:1 拉出且不置顶，过阈值后平滑插回后置槽位并置顶", () => {
		const width = 200;
		// 1. 小拉出 (30px <= 64px) -> 1:1 跟手，未超阈值
		const pull = getDraggedTopSlot(-30, width, true);
		expect(pull.topSlot.x).toBe(-30);
		expect(pull.topSlot.y).toBe(0);
		expect(pull.topSlot.rotate).toBeCloseTo(-2.4, 1);
		expect(pull.isPastThreshold).toBe(false);
		expect(pull.pullProgress).toBeCloseTo(30 / 64, 2);
		expect(pull.insertProgress).toBe(0);

		// 2. 刚好达拉出阈值 (64px)
		const peak = getDraggedTopSlot(-64, width, true);
		expect(peak.topSlot.x).toBe(-64);
		expect(peak.topSlot.y).toBe(0);
		expect(peak.isPastThreshold).toBe(false);

		// 3. 继续向左拖动 (102px，过半插入) -> 正在向左后槽位 (-11px, -8px) 滑入
		const inserting = getDraggedTopSlot(-102, width, true);
		expect(inserting.isPastThreshold).toBe(true);
		expect(inserting.insertProgress).toBeCloseTo(0.5, 1);
		expect(inserting.topSlot.x).toBeCloseTo(-37.5, 1);
		expect(inserting.topSlot.y).toBeCloseTo(-4, 1);
		expect(inserting.topSlot.scale).toBeCloseTo(0.98, 2);

		// 4. 充分拖动 (140px) -> 完全进入左侧后置槽位
		const inserted = getDraggedTopSlot(-140, width, true);
		expect(inserted.isPastThreshold).toBe(true);
		expect(inserted.insertProgress).toBe(1);
		expect(inserted.topSlot.x).toBeCloseTo(-11, 1);
		expect(inserted.topSlot.y).toBe(-8);
		expect(inserted.topSlot.scale).toBe(0.96);
		expect(inserted.topSlot.rotate).toBe(-1.5);
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
