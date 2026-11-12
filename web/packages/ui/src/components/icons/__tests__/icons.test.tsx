import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { IslandIcon, MorphIcon, TimelineIcon } from "../drawn-icons";

describe("自绘图标", () => {
	it.each([
		["灵动岛", IslandIcon],
		["时间线", TimelineIcon],
		["变形", MorphIcon],
	] as const)("%s 保留装饰性 SVG 的读屏隐藏", (_name, Icon) => {
		const { container } = render(<Icon />);
		expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
		expect(screen.queryByRole("img")).toBeNull();
	});

	it.each([
		["灵动岛", IslandIcon],
		["时间线", TimelineIcon],
		["变形", MorphIcon],
	] as const)("%s 支持独立命名与原生 SVG ref", (name, Icon) => {
		const ref = createRef<SVGSVGElement>();
		render(<Icon ref={ref} role="img" aria-label={name} />);
		expect(screen.getByRole("img", { name })).toBe(ref.current);
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
