import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BubbleOutline } from "../BubbleOutline";

function getStrokePaths(container: HTMLElement): string[] {
	return [...container.querySelectorAll("svg path[stroke-dashoffset]")].map(
		(p) => p.getAttribute("d") ?? "",
	);
}

function getFillPath(container: HTMLElement): string | null {
	return container.querySelector('svg path:not([fill="none"])')?.getAttribute("d") ?? null;
}

describe("BubbleOutline 轮廓几何", () => {
	afterEach(cleanup);

	it("bottom 侧从尾巴尖端起笔，V 边 45° 沉降到边框中心线后沿圆角绕行", () => {
		const { container } = render(
			<BubbleOutline
				width={288}
				height={144}
				side="bottom"
				arrowOffset={144}
				showArrow
				progress={1}
			/>,
		);
		const [first, second] = getStrokePaths(container);
		// 尖端外露 10px，坐标即盒坐标，与静止态同轨道
		expect(first.startsWith("M 144 -10")).toBe(true);
		expect(second.startsWith("M 144 -10")).toBe(true);
		// V 边沉降点落在边框中心线 y=1 上，未夹持时对称 ±11
		expect(first).toContain("L 133 1");
		expect(second).toContain("L 155 1");
		expect(first).toContain("H 16 A 15 15 0 0 0 1 16 V 128 A 15 15 0 0 0 16 143 H 144");
		expect(second).toContain("H 272 A 15 15 0 0 1 287 16 V 128 A 15 15 0 0 1 272 143 H 144");
	});

	it("尾巴背景三角与描线共用同一沉降点", () => {
		const { container } = render(
			<BubbleOutline
				width={288}
				height={144}
				side="bottom"
				arrowOffset={144}
				showArrow
				progress={0}
			/>,
		);
		expect(getFillPath(container)).toBe("M 144 -10 L 133 1 H 155 Z");
		// 无尾巴形态不渲染背景三角
		const sticker = render(
			<BubbleOutline
				width={220}
				height={80}
				side="bottom"
				arrowOffset={110}
				showArrow={false}
				progress={1}
			/>,
		);
		expect(getFillPath(sticker.container)).toBeNull();
	});

	it("top 侧尖端在底边外侧，V 边沉降到边框中心线", () => {
		const { container } = render(
			<BubbleOutline
				width={220}
				height={80}
				side="top"
				arrowOffset={100}
				showArrow
				progress={1}
			/>,
		);
		const [first, second] = getStrokePaths(container);
		expect(first.startsWith("M 100 90")).toBe(true);
		expect(first).toContain("L 89 79 H 16 A 15 15 0 0 1 1 64 V 16 A 15 15 0 0 1 16 1 H 110");
		expect(second).toContain(
			"L 111 79 H 204 A 15 15 0 0 0 219 64 V 16 A 15 15 0 0 0 204 1 H 110",
		);
	});

	it("right 侧尖端在左边外侧，V 边沉降到边框中心线后沿周界绕行", () => {
		const { container } = render(
			<BubbleOutline
				width={220}
				height={80}
				side="right"
				arrowOffset={40}
				showArrow
				progress={1}
			/>,
		);
		const [first, second] = getStrokePaths(container);
		expect(first.startsWith("M -10 40")).toBe(true);
		expect(first).toContain("L 1 29 V 16 A 15 15 0 0 1 16 1 H 204 A 15 15 0 0 1 219 16 V 40");
		expect(second).toContain("L 1 51 V 64 A 15 15 0 0 0 16 79 H 204 A 15 15 0 0 0 219 64 V 40");
	});

	it("left 侧尖端在右边外侧，V 边沉降到边框中心线", () => {
		const { container } = render(
			<BubbleOutline
				width={220}
				height={80}
				side="left"
				arrowOffset={40}
				showArrow
				progress={1}
			/>,
		);
		const [first, second] = getStrokePaths(container);
		expect(first.startsWith("M 230 40")).toBe(true);
		expect(first).toContain("L 219 29 V 16 A 15 15 0 0 0 204 1 H 16 A 15 15 0 0 0 1 16 V 40");
		expect(second).toContain("L 219 51 V 64 A 15 15 0 0 1 204 79 H 16 A 15 15 0 0 1 1 64 V 40");
	});

	it("沉降点撞圆角时夹持到直边段，保持尾巴与周界连续", () => {
		const { container } = render(
			<BubbleOutline
				width={288}
				height={144}
				side="bottom"
				arrowOffset={24}
				showArrow
				progress={1}
			/>,
		);
		const [first, second] = getStrokePaths(container);
		// arrowOffset=24 时左侧沉降点 13 落入 16px 圆角区，夹持到 16
		expect(first).toContain("L 16 1 H 16");
		expect(second).toContain("L 35 1");
		expect(getFillPath(container)).toBe("M 24 -10 L 16 1 H 35 Z");
	});

	it("无尾巴时从周界中点起笔，不出现界外坐标", () => {
		const { container } = render(
			<BubbleOutline
				width={220}
				height={80}
				side="bottom"
				arrowOffset={100}
				showArrow={false}
				progress={1}
			/>,
		);
		const [first, second] = getStrokePaths(container);
		expect(first.startsWith("M 110 1")).toBe(true);
		expect(second.startsWith("M 110 1")).toBe(true);
		for (const d of [first, second]) {
			for (const value of d.matchAll(/(-?[\d.]+)/g)) {
				expect(Number(value[1])).toBeGreaterThanOrEqual(-1);
			}
		}
	});
});
