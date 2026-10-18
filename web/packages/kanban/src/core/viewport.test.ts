import { describe, expect, it } from "vitest";
import {
	clampScale,
	DEFAULT_FIT_PADDING,
	DEFAULT_SCALE_LIMITS,
	edgePanSpeed,
	fitViewport,
	IDENTITY_VIEWPORT,
	normalizeViewport,
	panBy,
	panWithin,
	pinchViewport,
	revealRect,
	stepScale,
	zoomAt,
	zoomByFactor,
} from "./viewport.ts";

describe("clampScale", () => {
	it("缩放限制在 0.3 到 2", () => {
		expect(DEFAULT_SCALE_LIMITS).toEqual({ min: 0.3, max: 2 });
		expect(clampScale(0.1, DEFAULT_SCALE_LIMITS)).toBe(0.3);
		expect(clampScale(5, DEFAULT_SCALE_LIMITS)).toBe(2);
		expect(clampScale(1.25, DEFAULT_SCALE_LIMITS)).toBe(1.25);
	});

	it("非有限数收敛为 1，1 在范围外时再收敛到范围内", () => {
		expect(clampScale(Number.NaN, DEFAULT_SCALE_LIMITS)).toBe(1);
		expect(clampScale(Number.NaN, { min: 1.5, max: 2 })).toBe(1.5);
		expect(clampScale(Number.POSITIVE_INFINITY, { min: 0.3, max: 0.8 })).toBe(0.8);
	});
});

describe("normalizeViewport", () => {
	it("合法视口原样返回", () => {
		expect(normalizeViewport({ scale: 1.5, x: -20, y: 30 }, DEFAULT_SCALE_LIMITS)).toEqual({
			scale: 1.5,
			x: -20,
			y: 30,
		});
	});

	it("缩放收敛到范围内：0 与超限的值不会进入后续除法", () => {
		expect(normalizeViewport({ scale: 0, x: 1, y: 2 }, DEFAULT_SCALE_LIMITS).scale).toBe(0.3);
		expect(normalizeViewport({ scale: 5, x: 1, y: 2 }, DEFAULT_SCALE_LIMITS).scale).toBe(2);
	});

	it("非有限的平移视为 0", () => {
		expect(
			normalizeViewport(
				{ scale: Number.NaN, x: Number.POSITIVE_INFINITY, y: Number.NaN },
				DEFAULT_SCALE_LIMITS,
			),
		).toEqual({ scale: 1, x: 0, y: 0 });
	});
});

describe("zoomAt", () => {
	it("以锚点为中心缩放：锚点下的内容点保持不动", () => {
		const viewport = { scale: 1, x: 100, y: 50 };
		const anchor = { x: 300, y: 250 };
		// 锚点下的内容点是 ((300-100)/1, (250-50)/1) = (200, 200)

		const zoomed = zoomAt(viewport, anchor, 2, DEFAULT_SCALE_LIMITS);

		expect(zoomed.scale).toBe(2);
		expect((anchor.x - zoomed.x) / zoomed.scale).toBe(200);
		expect((anchor.y - zoomed.y) / zoomed.scale).toBe(200);
	});

	it("目标缩放越界时先收敛再缩放", () => {
		expect(zoomAt(IDENTITY_VIEWPORT, { x: 0, y: 0 }, 10, DEFAULT_SCALE_LIMITS).scale).toBe(2);
		expect(zoomAt(IDENTITY_VIEWPORT, { x: 0, y: 0 }, 0.01, DEFAULT_SCALE_LIMITS).scale).toBe(
			0.3,
		);
	});

	it("按系数缩放（滚轮与双击的基础）", () => {
		const zoomed = zoomByFactor(IDENTITY_VIEWPORT, { x: 0, y: 0 }, 1.5, DEFAULT_SCALE_LIMITS);

		expect(zoomed.scale).toBe(1.5);
	});
});

describe("stepScale", () => {
	it("按钮与键盘的缩放步进是 1.25 倍，到限制为止", () => {
		expect(stepScale(1, 1, DEFAULT_SCALE_LIMITS)).toBe(1.25);
		expect(stepScale(1, -1, DEFAULT_SCALE_LIMITS)).toBe(0.8);
		expect(stepScale(1.9, 1, DEFAULT_SCALE_LIMITS)).toBe(2);
		expect(stepScale(0.31, -1, DEFAULT_SCALE_LIMITS)).toBe(0.3);
	});
});

describe("panBy", () => {
	it("平移不改变缩放", () => {
		expect(panBy({ scale: 1.5, x: 10, y: 20 }, -4, 6)).toEqual({ scale: 1.5, x: 6, y: 26 });
	});
});

describe("fitViewport", () => {
	const container = { width: 1000, height: 600 };

	it("内容比窗口小：放大到刚好装下但不超过 100%，居中", () => {
		const viewport = fitViewport(container, { width: 500, height: 300 });

		expect(viewport).toEqual({ scale: 1, x: 250, y: 150 });
	});

	it("内容略大于窗口：缩小到刚好装下，两侧留出内边距", () => {
		// 可用 952×552；2000 宽的内容缩到 0.8 以上才算「适应」，这里 1000 宽内容缩到 0.952
		const viewport = fitViewport(container, { width: 1000, height: 400 });

		expect(viewport.scale).toBeCloseTo(0.952, 3);
		expect(viewport.x).toBeCloseTo(24, 5);
	});

	it("内容远大于窗口：缩放不低于 0.8，装不下的部分靠平移，从左上角开始", () => {
		const viewport = fitViewport(container, { width: 2000, height: 600 });

		expect(viewport.scale).toBe(0.8);
		expect(viewport.x).toBe(24);
		// 高度 480 小于窗口：纵向仍居中
		expect(viewport.y).toBe(60);
	});

	it("最小适应缩放可调，并始终在缩放范围内", () => {
		expect(fitViewport(container, { width: 4000, height: 4000 }, { minScale: 0.5 }).scale).toBe(
			0.5,
		);
		expect(fitViewport(container, { width: 4000, height: 4000 }, { minScale: 0.1 }).scale).toBe(
			0.3,
		);
	});

	it("没有内容尺寸时回到 100% 并居中不报错", () => {
		expect(fitViewport(container, { width: 0, height: 0 })).toEqual({
			scale: 1,
			x: 500,
			y: 300,
		});
	});
});

describe("revealRect", () => {
	const container = { width: 800, height: 600 };
	const viewport = { scale: 1, x: 0, y: 0 };

	it("已经在窗口内（含边距）时不动", () => {
		const rect = { left: 100, top: 100, right: 200, bottom: 160 };

		expect(revealRect(viewport, container, rect, 8)).toBe(viewport);
	});

	it("超出右下边缘时平移到刚好露出，并保留边距", () => {
		const rect = { left: 750, top: 560, right: 850, bottom: 640 };

		expect(revealRect(viewport, container, rect, 8)).toEqual({ scale: 1, x: -58, y: -48 });
	});

	it("超出左上边缘时反向平移", () => {
		const rect = { left: -50, top: -20, right: 40, bottom: 30 };

		expect(revealRect(viewport, container, rect, 8)).toEqual({ scale: 1, x: 58, y: 28 });
	});

	it("比窗口还大时对齐到起始边", () => {
		const rect = { left: -100, top: 10, right: 1200, bottom: 100 };

		expect(revealRect(viewport, container, rect, 8).x).toBe(108);
	});
});

describe("pinchViewport", () => {
	it("双指拉开：缩放与指间距成比例，起始中点下的内容点跟到现在的中点", () => {
		const start = { scale: 1, x: 0, y: 0 };

		const pinched = pinchViewport(
			start,
			[
				{ x: 100, y: 100 },
				{ x: 200, y: 100 },
			],
			[
				{ x: 50, y: 100 },
				{ x: 250, y: 100 },
			],
			DEFAULT_SCALE_LIMITS,
		);

		// 间距 100 → 200，缩放 2；起始中点 (150,100) 下的内容点 (150,100) 现在落在 (150,100)
		expect(pinched).toEqual({ scale: 2, x: -150, y: -100 });
	});

	it("双指一起移动（间距不变）等于平移", () => {
		const start = { scale: 1.5, x: 10, y: 10 };

		const moved = pinchViewport(
			start,
			[
				{ x: 100, y: 100 },
				{ x: 200, y: 100 },
			],
			[
				{ x: 130, y: 120 },
				{ x: 230, y: 120 },
			],
			DEFAULT_SCALE_LIMITS,
		);

		expect(moved.scale).toBe(1.5);
		expect(moved.x).toBeCloseTo(40, 9);
		expect(moved.y).toBeCloseTo(30, 9);
	});

	it("缩放越界时收敛，指间距为 0 时不变", () => {
		const start = { scale: 1.5, x: 0, y: 0 };
		const same = [
			{ x: 10, y: 10 },
			{ x: 10, y: 10 },
		] as const;

		expect(pinchViewport(start, same, same, DEFAULT_SCALE_LIMITS)).toEqual(start);
	});
});

describe("edgePanSpeed", () => {
	const region = { left: 100, top: 100, right: 900, bottom: 600 };

	it("远离边缘时不平移", () => {
		expect(edgePanSpeed({ x: 500, y: 350 }, region)).toEqual({ x: 0, y: 0 });
		expect(edgePanSpeed({ x: 148, y: 148 }, region, { edge: 48 })).toEqual({ x: 0, y: 0 });
	});

	it("靠近左或上边缘：内容向右、向下移动（正方向）；靠近右或下边缘为负", () => {
		expect(edgePanSpeed({ x: 110, y: 350 }, region).x).toBeGreaterThan(0);
		expect(edgePanSpeed({ x: 890, y: 350 }, region).x).toBeLessThan(0);
		expect(edgePanSpeed({ x: 500, y: 110 }, region).y).toBeGreaterThan(0);
		expect(edgePanSpeed({ x: 500, y: 590 }, region).y).toBeLessThan(0);
	});

	it("越靠近边缘越快，贴边与越界时达到最大速度", () => {
		const slow = edgePanSpeed({ x: 140, y: 350 }, region, { edge: 48, maxSpeed: 1000 }).x;
		const fast = edgePanSpeed({ x: 110, y: 350 }, region, { edge: 48, maxSpeed: 1000 }).x;

		expect(fast).toBeGreaterThan(slow);
		expect(edgePanSpeed({ x: 100, y: 350 }, region, { maxSpeed: 1000 }).x).toBe(1000);
		expect(edgePanSpeed({ x: 20, y: 350 }, region, { maxSpeed: 1000 }).x).toBe(1000);
	});

	it("两个方向互不影响，边缘 48px 以内才平移（默认）", () => {
		expect(edgePanSpeed({ x: 148, y: 110 }, region)).toMatchObject({ x: 0 });
		expect(edgePanSpeed({ x: 148, y: 110 }, region).y).toBeGreaterThan(0);
		expect(edgePanSpeed({ x: 147, y: 350 }, region).x).toBeGreaterThan(0);
	});

	it("区域比两个边缘带还窄时两侧抵消，不会朝某一侧飞出去", () => {
		expect(edgePanSpeed({ x: 130, y: 350 }, { ...region, left: 100, right: 160 }).x).toBe(0);
	});
});

describe("panWithin", () => {
	const container = { width: 800, height: 600 };
	const big = { width: 2000, height: 1500 };
	const at = (x: number, y: number, scale = 1) => ({ scale, x, y });

	it("内容比容器大：在边距内自由平移", () => {
		expect(panWithin(at(0, 0), container, big, -100, -50, 24)).toEqual(at(-100, -50));
	});

	it("起始边最多拉到离容器边缘 margin 处", () => {
		expect(panWithin(at(0, 0), container, big, 100, 100, 24)).toEqual(at(24, 24));
	});

	it("末边最多拉到离容器边缘 margin 处，随缩放换算内容长度", () => {
		expect(panWithin(at(-1200, 0), container, big, -100, 0, 24).x).toBe(-1224);
		// 缩放 0.5 时内容宽 1000：800 - 24 - 1000
		expect(panWithin(at(-100, 0, 0.5), container, big, -500, 0, 24).x).toBe(-224);
	});

	it("已经越界时允许朝回来的方向移动，不允许继续越界", () => {
		expect(panWithin(at(500, 0), container, big, 10, 0, 24).x).toBe(500);
		expect(panWithin(at(500, 0), container, big, -10, 0, 24).x).toBe(490);
	});

	it("内容比容器小的方向不平移", () => {
		const small = { width: 200, height: 100 };

		expect(panWithin(at(300, 250), container, small, 50, 50, 24)).toEqual(at(300, 250));
		expect(panWithin(at(300, 250), container, small, -50, -50, 24)).toEqual(at(300, 250));
	});

	it("两个方向分别限制，缩放不变", () => {
		expect(panWithin(at(0, -900, 1), container, big, 100, -100, 24)).toEqual(at(24, -924));
	});
});

describe("DEFAULT_FIT_PADDING", () => {
	it("是适应窗口不指定内边距时用的值", () => {
		const fitted = fitViewport({ width: 1000, height: 600 }, { width: 5000, height: 5000 });

		expect(fitted.x).toBe(DEFAULT_FIT_PADDING);
		expect(fitted.y).toBe(DEFAULT_FIT_PADDING);
	});
});
