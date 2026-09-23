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
		for (const title of ["品牌色阶", "主色与强调", "功能色", "中性带", "对比度审计"]) {
			expect(screen.getByRole("heading", { name: title })).toBeTruthy();
		}
	});

	it("速选含紫罗兰与暖珊瑚两枚站内典藏", () => {
		render(<PaletteGenerator />);
		expect(screen.getByRole("button", { name: "主色 紫罗兰" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "主色 暖珊瑚" })).toBeTruthy();
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

	it("组件试穿沙盒支持动作控件与状态反馈横幅切换", () => {
		render(<PaletteGenerator />);
		expect(screen.getByRole("heading", { name: "组件试穿沙盒" })).toBeTruthy();
		expect(screen.getByText("主要动作 Primary")).toBeTruthy();

		// 切换到状态反馈横幅
		fireEvent.click(screen.getByRole("button", { name: "状态反馈横幅" }));
		expect(screen.getByText("操作成功")).toBeTruthy();
		expect(screen.getByText("待决变更")).toBeTruthy();
	});

	it("代码导出支持 CSS 变量与 Tailwind v4 切换并可一键复制", async () => {
		render(<PaletteGenerator />);
		expect(screen.getByRole("heading", { name: "代码导出" })).toBeTruthy();
		expect(screen.getByText(/--brand:/)).toBeTruthy();

		// 切换到 Tailwind v4
		fireEvent.click(screen.getByRole("button", { name: "Tailwind v4 @theme" }));
		expect(screen.getByText(/--color-brand-50:/)).toBeTruthy();

		// 复制代码
		fireEvent.click(screen.getByRole("button", { name: /复制代码/ }));
		await waitFor(() => {
			expect(navigator.clipboard.writeText).toHaveBeenCalled();
		});
	});

	it("HEX 文本输入框可直接驱动主色重算", () => {
		render(<PaletteGenerator />);
		const input = screen.getByDisplayValue("#2563eb");
		fireEvent.change(input, { target: { value: "#10b981" } });
		expect(screen.getAllByText("#10B981").length).toBeGreaterThanOrEqual(1);
	});
});
