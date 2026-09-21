import { BRAND_TOKENS } from "@features/lab/palette/model/tokens";
import { AccessibilitySection } from "@features/lab/palette/ui/AccessibilitySection";
import { ChartAndNeonSection } from "@features/lab/palette/ui/ChartAndNeonSection";
import { ColorSwatch } from "@features/lab/palette/ui/ColorSwatch";
import { ComponentPlaygroundSection } from "@features/lab/palette/ui/ComponentPlaygroundSection";
import { PaletteHero } from "@features/lab/palette/ui/PaletteHero";
import { StatusMatrixSection } from "@features/lab/palette/ui/StatusMatrixSection";
import { SurfaceLayersSection } from "@features/lab/palette/ui/SurfaceLayersSection";
import { TokenExportSection } from "@features/lab/palette/ui/TokenExportSection";
import { TonalRampSection } from "@features/lab/palette/ui/TonalRampSection";
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
		it("正确渲染色彩名称、变量名与对比度", () => {
			render(<ColorSwatch token={BRAND_TOKENS[0]} mode="light" />);
			expect(screen.getByText("品牌主色")).toBeDefined();
			expect(screen.getByText("--brand")).toBeDefined();
			expect(screen.getByText("Primary Brand Voice")).toBeDefined();
		});

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
			render(<ColorSwatch token={BRAND_TOKENS[0]} mode="light" />);
			const copyVarBtn = screen.getByText("--brand");
			fireEvent.click(copyVarBtn);
			await waitFor(() => {
				expect(navigator.clipboard.writeText).toHaveBeenCalledWith("var(--brand)");
			});
		});

		it("剪贴板异常时优雅捕获不崩溃", async () => {
			vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(
				new Error("Permission denied"),
			);
			render(<ColorSwatch token={BRAND_TOKENS[0]} mode="light" />);
			const copyVarBtn = screen.getByText("--brand");
			fireEvent.click(copyVarBtn);
			await waitFor(() => {
				expect(navigator.clipboard.writeText).toHaveBeenCalled();
			});
		});
	});

	describe("PaletteHero", () => {
		it("渲染主视觉色板与 Hue 286 标签", () => {
			const onModeChange = vi.fn();
			render(<PaletteHero mode="sync" onModeChange={onModeChange} resolvedTheme="light" />);
			expect(screen.getByText("冷香紫罗兰签名体系")).toBeDefined();
			expect(screen.getByText(/Hue 286°/)).toBeDefined();
		});

		it("双域并置模式下并列渲染浅色与深色主色块", () => {
			render(<PaletteHero mode="dual" onModeChange={vi.fn()} resolvedTheme="light" />);
			expect(screen.getByText(/Royal Iris · 浅色/)).toBeDefined();
			expect(screen.getByText(/Amethyst · 深色/)).toBeDefined();
		});

		it("点击导出按钮复制全部变量", async () => {
			render(<PaletteHero mode="sync" onModeChange={vi.fn()} resolvedTheme="light" />);
			const exportBtn = screen.getByText("导出品牌变量");
			fireEvent.click(exportBtn);
			await waitFor(() => {
				expect(navigator.clipboard.writeText).toHaveBeenCalled();
			});
		});
	});

	describe("TonalRampSection", () => {
		it("渲染 11 阶紫罗兰阶梯", () => {
			render(<TonalRampSection />);
			expect(screen.getByText("紫罗兰全域色阶光谱")).toBeDefined();
			expect(screen.getByText("500")).toBeDefined();
			expect(screen.getByText("950")).toBeDefined();
		});
	});

	describe("SurfaceLayersSection", () => {
		it("渲染空间表面体系", () => {
			render(<SurfaceLayersSection mode="light" />);
			expect(screen.getByText("明暗双重画布与空间表面体系")).toBeDefined();
			expect(screen.getByText(/L0 · 总画布/)).toBeDefined();
			expect(screen.getByText(/L1 · 卡片面板/)).toBeDefined();
		});
	});

	describe("StatusMatrixSection", () => {
		it("渲染三种状态语义色与真实横幅", () => {
			render(<StatusMatrixSection mode="light" />);
			expect(screen.getByText("行为与状态语义调色板")).toBeDefined();
			expect(screen.getByText("危险操作拦截")).toBeDefined();
			expect(screen.getByText("草稿未同步提醒")).toBeDefined();
			expect(screen.getByText("修订发布成功")).toBeDefined();
		});
	});

	describe("ChartAndNeonSection", () => {
		it("渲染图表 5 色与霓虹发光光柱", () => {
			render(<ChartAndNeonSection mode="light" />);
			expect(screen.getByText("协调图表调色板（5 色）")).toBeDefined();
			expect(screen.getByText("霓虹高发光调色板（Neon）")).toBeDefined();
			expect(screen.getByText("霓虹紫")).toBeDefined();
		});

		it("双域并置模式下支持传入 resolvedTheme", () => {
			render(<ChartAndNeonSection mode="dual" resolvedTheme="dark" />);
			expect(screen.getByText("浅色图表光谱（5 色）")).toBeDefined();
			expect(screen.getByText("深色图表光谱（5 色）")).toBeDefined();
		});
	});

	describe("ComponentPlaygroundSection", () => {
		it("渲染组件变体演练选项卡与方言对照", () => {
			render(<ComponentPlaygroundSection />);
			expect(screen.getByText("基础组件主题实装演练")).toBeDefined();
			expect(screen.getByText(/品牌主动作 \(Brand\)/)).toBeDefined();
			expect(screen.getByText(/dialect-public/)).toBeDefined();
		});
	});

	describe("AccessibilitySection", () => {
		it("渲染 WCAG 对比度合规审计表格且 8 组组合全部达标", () => {
			render(<AccessibilitySection />);
			expect(screen.getByText("无障碍与对比度全景审计")).toBeDefined();
			expect(screen.getByText("品牌色在画布底色上")).toBeDefined();
			expect(screen.getByText("正文主墨色在画布底色上")).toBeDefined();
			expect(screen.getAllByText("全部达标").length).toBe(8);
		});
	});

	describe("TokenExportSection", () => {
		it("渲染代码导出选项卡与复制按钮", async () => {
			render(<TokenExportSection />);
			expect(screen.getByText("色彩令牌导出")).toBeDefined();
			const copyBtn = screen.getByText("复制当前片段");
			fireEvent.click(copyBtn);
			await waitFor(() => {
				expect(navigator.clipboard.writeText).toHaveBeenCalled();
			});
		});
	});
});
