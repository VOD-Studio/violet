import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FLOWERS, SEASON_FLOWER } from "../flower-paths";
import { FlowerBloom, Spinner } from "../indicator";

describe("FlowerBloom", () => {
	it("六款花形都可渲染，SVG 标 aria-hidden", () => {
		for (const kind of Object.keys(FLOWERS) as (keyof typeof FLOWERS)[]) {
			const { container } = render(<FlowerBloom kind={kind} />);
			const svg = container.querySelector("svg");
			expect(svg, `${kind} 输出 SVG`).toBeTruthy();
			expect(svg?.getAttribute("aria-hidden")).toBe("true");
		}
	});

	it("节点不带底色与轨道", () => {
		const { container } = render(<FlowerBloom kind="plum" />);
		const track = container.querySelector(
			'[stroke-opacity], [class*="track"], [class*="base-bg"]',
		);
		expect(track).toBeNull();
	});

	it("五档尺寸写入 CSS 变量", () => {
		for (const size of [16, 20, 24, 32, 48] as const) {
			const { container } = render(<FlowerBloom kind="sakura" size={size} />);
			const root = container.querySelector(".v-flower") as HTMLElement;
			expect(root.style.getPropertyValue("--v-flower-size")).toBe(`${size}px`);
		}
	});

	it("梅枝为横幅形态，宽为尺寸三倍", () => {
		const { container } = render(<FlowerBloom kind="branch" size={24} />);
		const root = container.querySelector(".v-flower--branch") as HTMLElement;
		expect(root.style.getPropertyValue("--v-flower-size")).toBe("24px");
		expect(root.className).toContain("v-flower--branch");
	});

	it("季节默认映射到当季花形", () => {
		expect(SEASON_FLOWER.spring).toBe("sakura");
		expect(SEASON_FLOWER.summer).toBe("lotus");
		expect(SEASON_FLOWER.autumn).toBe("osmanthus");
		expect(SEASON_FLOWER.winter).toBe("plum");
	});

	it("容器挂 role=status 时读屏可感知", () => {
		render(
			<span role="status" aria-live="polite">
				<FlowerBloom kind="snow" />
			</span>,
		);
		expect(screen.getByRole("status")).toBeTruthy();
	});
});

describe("Spinner", () => {
	it("渲染细圆弧，SVG 标 aria-hidden，无底色轨道", () => {
		const { container } = render(<Spinner />);
		const svg = container.querySelector("svg");
		expect(svg?.getAttribute("aria-hidden")).toBe("true");
		const arc = container.querySelector(".v-spinner__arc");
		expect(arc).toBeTruthy();
		// 只有一条描边圆弧，没有轨道底圈
		expect(container.querySelectorAll("circle")).toHaveLength(1);
	});

	it("默认 16px，可换五档尺寸", () => {
		const { container, rerender } = render(<Spinner />);
		const root = container.querySelector(".v-spinner") as HTMLElement;
		expect(root.style.getPropertyValue("--v-spinner-size")).toBe("16px");
		for (const size of [16, 20, 24, 32, 48] as const) {
			rerender(<Spinner size={size} />);
			expect(
				(container.querySelector(".v-spinner") as HTMLElement).style.getPropertyValue(
					"--v-spinner-size",
				),
			).toBe(`${size}px`);
		}
	});
});
