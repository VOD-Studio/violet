import { describe, expect, it } from "vitest";
import { computePosition } from "../floating";

describe("CartoonPopover floating position calculation", () => {
	function mockRect(overrides: Partial<DOMRect> = {}): DOMRect {
		return {
			x: 100,
			y: 100,
			top: 100,
			bottom: 140,
			left: 100,
			right: 180,
			width: 80,
			height: 40,
			toJSON: () => ({}),
			...overrides,
		};
	}

	it("默认在下方居中展示并精准对齐中心小尾巴", () => {
		const triggerRect = mockRect();
		const result = computePosition({
			triggerRect,
			contentWidth: 200,
			contentHeight: 120,
			side: "bottom",
			align: "center",
			sideOffset: 10,
			viewportWidth: 1000,
			viewportHeight: 800,
		});

		expect(result.actualSide).toBe("bottom");
		expect(result.y).toBe(150); // 140 + 10
		// trigger 居中 100 + 40 = 140，内容居中 140 - 100 = 40
		expect(result.x).toBe(40);
		// 小尾巴应该指向触发器中心 (140 - 40 = 100)
		expect(result.arrowOffset).toBe(100);
	});

	it("当下方空间不足且上方充裕时自动向上翻转", () => {
		const triggerRect = mockRect({
			top: 500,
			bottom: 540,
		});
		const result = computePosition({
			triggerRect,
			contentWidth: 200,
			contentHeight: 120,
			side: "bottom",
			sideOffset: 10,
			viewportWidth: 1000,
			viewportHeight: 600, // 底部只剩 60px，放不下 120+10
		});

		expect(result.actualSide).toBe("top");
		expect(result.y).toBe(370); // 500 - 120 - 10
	});

	it("在视口左边缘自动保护不被裁剪", () => {
		const triggerRect = mockRect({
			left: 10,
			right: 50,
			width: 40,
		});
		const result = computePosition({
			triggerRect,
			contentWidth: 240,
			contentHeight: 100,
			side: "bottom",
			align: "center",
			collisionPadding: 8,
			viewportWidth: 800,
			viewportHeight: 600,
		});

		// 居中理论为 30 - 120 = -90，被夹紧到 8
		expect(result.x).toBe(8);
		// 小尾巴受气泡圆角安全区域（minOffset = 24）保护
		expect(result.arrowOffset).toBe(24);
	});
});
