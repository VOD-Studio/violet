import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PaletteGenerator } from "../PaletteGenerator";

describe("色板生成器", () => {
	it("主色速选、自定义 HSV 选色器与五个推导区块齐备", () => {
		render(<PaletteGenerator />);
		expect(screen.getByRole("group", { name: "主色速选" })).toBeTruthy();
		expect(screen.getByText("自定义主色")).toBeTruthy();
		for (const title of ["品牌色阶", "品牌角色", "功能色", "中性带与语义角色", "对比度审计"]) {
			expect(screen.getByRole("heading", { name: title })).toBeTruthy();
		}
	});

	it("速选含现役紫罗兰与曾用暖珊瑚两枚站内典藏", () => {
		render(<PaletteGenerator />);
		expect(screen.getByRole("button", { name: "主色 紫罗兰 · 现役预设" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "主色 暖珊瑚 · 曾用预设" })).toBeTruthy();
	});

	it("换主色后整板重推导：点速选松绿即更新读出与色阶", () => {
		render(<PaletteGenerator />);
		expect(screen.getByText("#2563EB")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "主色 松绿" }));
		expect(screen.getByText("#059669")).toBeTruthy();
		expect(screen.getByTitle(/^50 · #/)).toBeTruthy();
	});

	it("审计全部通过（默认种子）", () => {
		render(<PaletteGenerator />);
		expect(screen.queryByText("✗")).toBeNull();
		expect(screen.getAllByText("✓").length).toBeGreaterThanOrEqual(10);
	});
});
