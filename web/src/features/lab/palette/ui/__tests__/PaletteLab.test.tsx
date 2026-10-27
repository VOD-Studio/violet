import { PRIMARY_TOKENS } from "@features/lab/palette/model/tokens";
import { ColorSwatch } from "@features/lab/palette/ui/ColorSwatch";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 模拟 navigator.clipboard 与 window.isSecureContext
Object.defineProperty(window, "isSecureContext", {
	value: true,
	configurable: true,
});
Object.assign(navigator, {
	clipboard: {
		writeText: vi.fn().mockResolvedValue(undefined),
	},
});

describe("Palette UI Components", () => {
	beforeEach(() => {
		vi.mocked(navigator.clipboard.writeText).mockClear();
		vi.mocked(navigator.clipboard.writeText).mockResolvedValue(undefined);
	});

	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	describe("ColorSwatch", () => {
		it("针对空间表面材质正确计算其上文字对比度并显示 Aa", () => {
			const canvasSurface = {
				variable: "--card",
				name: "卡片表面",
				role: "Card",
				light: "oklch(1 0 0)",
				dark: "oklch(0.185 0.015 286)",
				description: "卡片",
				isSurface: true,
				onSurfaceForeground: {
					variable: "--card-foreground",
					name: "卡片文字",
					light: "oklch(0.19 0.015 286)",
					dark: "oklch(0.955 0.008 286)",
				},
			};
			render(<ColorSwatch token={canvasSurface} mode="light" />);
			expect(screen.getAllByText(/Aa/).length).toBeGreaterThan(0);
			expect(screen.getByText("AAA")).toBeDefined();
		});

		it("点击复制按钮调用 clipboard.writeText", async () => {
			render(<ColorSwatch token={PRIMARY_TOKENS[0]} mode="light" />);
			const copyVarBtn = screen.getByText("--primary-base");
			fireEvent.click(copyVarBtn);
			await waitFor(() => {
				expect(navigator.clipboard.writeText).toHaveBeenCalledWith("var(--primary-base)");
			});
		});
	});
});
