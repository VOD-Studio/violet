import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BubbleOutline } from "../BubbleOutline";
import type { CartoonPopoverSide } from "../types";

function coordinates(path: string): number[] {
	return [...path.matchAll(/-?\d+(?:\.\d+)?/g)].map(([value]) => Number(value));
}

describe("BubbleOutline 轮廓几何", () => {
	afterEach(cleanup);

	it.each<CartoonPopoverSide>([
		"bottom",
		"top",
		"right",
		"left",
	])("%s 侧小尾巴指向触发器，宽度不超过 16px、外露不超过 8px，填充与描线同轨", (side) => {
		const width = 220;
		const height = 80;
		const arrowOffset = side === "top" || side === "bottom" ? 110 : 40;
		const { container } = render(
			<BubbleOutline
				width={width}
				height={height}
				side={side}
				arrowOffset={arrowOffset}
				showArrow
				progress={1}
			/>,
		);
		const fill = container.querySelector('svg path:not([fill="none"])');
		const strokes = [...container.querySelectorAll("svg path[stroke-dashoffset]")];
		expect(fill).not.toBeNull();
		expect(strokes).toHaveLength(2);
		const points = coordinates(fill?.getAttribute("d") ?? "");
		const [startX, startY, baseX, baseY, far] = points;
		const vertical = side === "top" || side === "bottom";
		const tip = vertical ? startX : startY;
		const outer = vertical ? startY : startX;
		const near = vertical ? baseX : baseY;
		const edge = vertical ? baseY : baseX;
		const signedTip =
			side === "bottom" || side === "right" ? outer : outer - (vertical ? height : width);
		expect(tip).toBe(arrowOffset);
		expect(Math.abs(signedTip)).toBeLessThanOrEqual(8);
		expect(far - near).toBeLessThanOrEqual(16);
		expect(far - near).toBeGreaterThan(0);
		expect(edge).toBe(
			side === "bottom" || side === "right" ? 1 : (vertical ? height : width) - 1,
		);
		const first = coordinates(strokes[0].getAttribute("d") ?? "");
		const second = coordinates(strokes[1].getAttribute("d") ?? "");
		expect(first.slice(0, 4)).toEqual([startX, startY, baseX, baseY]);
		expect(second.slice(0, 4)).toEqual(
			vertical ? [startX, startY, far, baseY] : [startX, startY, baseX, far],
		);
	});

	it("靠近圆角时尾巴连接点留在直边上", () => {
		const { container } = render(
			<BubbleOutline
				width={220}
				height={80}
				side="bottom"
				arrowOffset={21}
				showArrow
				progress={1}
			/>,
		);
		const fill = container.querySelector('svg path:not([fill="none"])');
		const [, , near, , far] = coordinates(fill?.getAttribute("d") ?? "");
		expect(near).toBeGreaterThanOrEqual(16);
		expect(far).toBeLessThanOrEqual(204);
	});

	it("不显示尾巴时无背景三角，轮廓从周界中点闭合", () => {
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
		expect(container.querySelector('svg path:not([fill="none"])')).toBeNull();
		const strokes = container.querySelectorAll("svg path[stroke-dashoffset]");
		expect(strokes).toHaveLength(2);
		expect(coordinates(strokes[0].getAttribute("d") ?? "").slice(0, 2)).toEqual([110, 1]);
		expect(coordinates(strokes[1].getAttribute("d") ?? "").slice(0, 2)).toEqual([110, 1]);
	});
});
