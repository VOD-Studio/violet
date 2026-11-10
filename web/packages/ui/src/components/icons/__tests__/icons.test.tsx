import { render } from "@testing-library/react";
import { CircleAlert } from "lucide-react";
import { describe, expect, it } from "vitest";
import { IslandIcon, MorphIcon, TimelineIcon } from "../drawn-icons";
import { iconProps } from "../icon-props";

describe("iconProps", () => {
	it("省略尺寸时取 16 档", () => {
		expect(iconProps()).toEqual({ size: 16, strokeWidth: 1.75 });
	});

	it.each([
		[12, 2],
		[14, 2],
		[16, 1.75],
		[18, 1.75],
		[20, 1.75],
		[24, 1.75],
	] as const)("%i 档线宽为 %f", (size, strokeWidth) => {
		expect(iconProps(size)).toEqual({ size, strokeWidth });
	});

	it("展开到 lucide 图标上得到对应尺寸与线宽", () => {
		const { container } = render(<CircleAlert {...iconProps(14)} />);
		const svg = container.querySelector("svg");
		expect(svg?.getAttribute("width")).toBe("14");
		expect(svg?.getAttribute("stroke-width")).toBe("2");
	});
});

describe("自绘图标", () => {
	it.each([
		["灵动岛", IslandIcon],
		["时间线", TimelineIcon],
		["变形", MorphIcon],
	] as const)("%s 走 24 网格并对读屏隐藏", (_name, Icon) => {
		const { container } = render(<Icon />);
		const svg = container.querySelector("svg");
		expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
		expect(svg?.getAttribute("fill")).toBe("none");
		expect(svg?.getAttribute("stroke")).toBe("currentColor");
		expect(svg?.getAttribute("stroke-width")).toBe("1.75");
		expect(svg?.getAttribute("aria-hidden")).toBe("true");
	});

	it("尺寸由 iconProps 决定，线宽可被 iconProps 覆盖", () => {
		const { container } = render(<IslandIcon {...iconProps(12)} />);
		const svg = container.querySelector("svg");
		expect(svg?.getAttribute("width")).toBe("12");
		expect(svg?.getAttribute("stroke-width")).toBe("2");
	});

	it("内容不出 2 的安全区", () => {
		const { container } = render(<TimelineIcon />);
		for (const node of container.querySelectorAll("circle")) {
			const cx = Number(node.getAttribute("cx"));
			const cy = Number(node.getAttribute("cy"));
			const r = Number(node.getAttribute("r"));
			expect(cx - r).toBeGreaterThanOrEqual(2);
			expect(cy - r).toBeGreaterThanOrEqual(2);
			expect(cx + r).toBeLessThanOrEqual(22);
			expect(cy + r).toBeLessThanOrEqual(22);
		}
	});
});
