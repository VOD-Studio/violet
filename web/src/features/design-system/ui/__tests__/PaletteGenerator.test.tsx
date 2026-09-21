import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PaletteGenerator } from "../PaletteGenerator";

describe("色板生成器", () => {
	it("色相与彩度控制及四个推导区块齐备", () => {
		render(<PaletteGenerator />);
		expect(screen.getByLabelText(/色相/)).toBeTruthy();
		expect(screen.getByLabelText(/彩度/)).toBeTruthy();
		for (const title of ["品牌色阶", "品牌角色", "功能色", "中性带与语义角色", "对比度审计"]) {
			expect(screen.getByRole("heading", { name: title })).toBeTruthy();
		}
	});

	it("审计全部通过（默认种子）", () => {
		render(<PaletteGenerator />);
		expect(screen.queryByText("✗")).toBeNull();
		expect(screen.getAllByText("✓").length).toBeGreaterThanOrEqual(10);
	});
});
