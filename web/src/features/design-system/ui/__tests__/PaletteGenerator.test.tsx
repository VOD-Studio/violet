import { oklchToRgb } from "@shared/lib/color-math";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PaletteGenerator } from "../PaletteGenerator";

vi.mock("@shared/ui/code-preview/components/CodeCard", () => ({
	CodeCard: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

/** 与组件 SEED_PRESETS[0] 同源的初始主色。 */
const VIOLET_SEED_HEX = oklchToRgb(0.53, 0.205, 286).hex;

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
		<a href={to}>{children}</a>
	),
}));

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

	it("换主色后整板重推导：点速选松绿即更新读出与色阶", () => {
		render(<PaletteGenerator />);
		expect(screen.getByText(VIOLET_SEED_HEX.toUpperCase())).toBeTruthy();
		fireEvent.click(screen.getByLabelText("主色 松绿"));
		expect(screen.getByText("#059669")).toBeTruthy();
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

	it("主色选择只更新本页明暗预览，不写入项目根主题", () => {
		render(<PaletteGenerator />);
		const lightPreview = document.querySelector<HTMLElement>('[data-palette-preview="light"]');
		expect(lightPreview).toBeTruthy();
		const initialPreviewPrimary = lightPreview?.style.getPropertyValue("--primary-base");
		const initialRootPrimary =
			document.documentElement.style.getPropertyValue("--primary-base");

		fireEvent.click(screen.getByLabelText("主色 松绿"));

		expect(lightPreview?.style.getPropertyValue("--primary-base")).not.toBe(
			initialPreviewPrimary,
		);
		expect(document.documentElement.style.getPropertyValue("--primary-base")).toBe(
			initialRootPrimary,
		);
	});

	it("悬停颜色卡显示对应变量定义", async () => {
		render(<PaletteGenerator />);
		const trigger = document.querySelector<HTMLButtonElement>(
			'button[title^="--warning-hover ·"]',
		);
		if (!trigger) {
			throw new Error("未找到警告色 Hover 卡片");
		}

		fireEvent.mouseEnter(trigger);

		const popover = await screen.findByRole("dialog", {
			name: "--warning-hover 颜色定义",
		});
		expect(popover).toBeTruthy();
	});

	it("HEX 文本输入框可直接驱动主色重算", () => {
		render(<PaletteGenerator />);
		const input = screen.getByDisplayValue(VIOLET_SEED_HEX);
		fireEvent.change(input, { target: { value: "#10b981" } });
		expect(screen.getAllByText("#10B981")[0]).toBeTruthy();
	});
});
