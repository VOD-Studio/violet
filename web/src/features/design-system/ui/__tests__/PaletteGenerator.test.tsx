import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaletteGenerator } from "../PaletteGenerator";

Object.defineProperty(window, "isSecureContext", {
	value: true,
	configurable: true,
});
Object.assign(navigator, {
	clipboard: {
		writeText: vi.fn().mockResolvedValue(undefined),
	},
});

describe("色板生成器", () => {
	beforeEach(() => {
		vi.mocked(navigator.clipboard.writeText).mockClear();
		vi.mocked(navigator.clipboard.writeText).mockResolvedValue(undefined);
	});

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

	it("色阶数字行与 11 列色块对齐齐备", () => {
		render(<PaletteGenerator />);
		for (const label of ["50", "100", "500", "950"]) {
			expect(
				screen.getByText(label, { selector: "div[aria-hidden='true'] > span" }),
			).toBeTruthy();
		}
		expect(screen.getByTitle(/^500 · #/)).toBeTruthy();
	});

	it("点击色阶列即复制该阶 HEX", async () => {
		render(<PaletteGenerator />);
		const cell = screen.getByTitle(/^300 · #/) as HTMLElement;
		const hex = cell.title.split(" · ")[1];
		fireEvent.click(cell);
		await waitFor(() => {
			expect(navigator.clipboard.writeText).toHaveBeenCalledWith(hex);
		});
	});

	it("悬停色块时读数浮层显形且对应数字高亮", () => {
		render(<PaletteGenerator />);
		const cell = screen.getByTitle(/^300 · #/) as HTMLElement;
		fireEvent.mouseEnter(cell);
		const overlay = cell.querySelector("span") as HTMLElement;
		expect(overlay.className).toContain("opacity-100");
		const num = screen.getByText("300", { selector: "div[aria-hidden='true'] > span" });
		expect(num.className).toContain("text-foreground");
		fireEvent.mouseLeave(cell);
		expect(overlay.className).toContain("opacity-0");
	});

	it("审计全部通过（默认种子）", () => {
		render(<PaletteGenerator />);
		expect(screen.queryByText("✗")).toBeNull();
		expect(screen.getAllByText("✓").length).toBeGreaterThanOrEqual(10);
	});
});
