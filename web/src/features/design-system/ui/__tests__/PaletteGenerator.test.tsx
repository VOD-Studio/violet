import { oklchToRgb } from "@shared/lib/color-math";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PaletteGenerator } from "../PaletteGenerator";

/** 与组件 SEED_PRESETS[0] 同源的初始主色。 */
const VIOLET_SEED_HEX = oklchToRgb(0.53, 0.205, 286).hex;

// Mock @tanstack/react-router 中的 Link（GuideLink 依赖路由上下文）
vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
		<a href={to}>{children}</a>
	),
}));

// shiki 高亮是异步且把文本拆进多个着色 span，与页面行为无关；
// mock 成纯文本 pre 以便断言代码内容
vi.mock("@shared/ui/code-preview/components/CodeCard", () => ({
	CodeCard: ({ code, title }: { code: string; title?: string }) => (
		<div data-title={title}>
			<pre>{code}</pre>
		</div>
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

	it("主色速选、自定义 HSV 选色器与推导区块齐备", () => {
		render(<PaletteGenerator />);
		expect(screen.getByRole("group", { name: "主色速选" })).toBeTruthy();
		expect(screen.getByText("自定义主色")).toBeTruthy();
		for (const title of [
			"主色色阶",
			"主色",
			"默认（中性色）",
			"信息",
			"成功",
			"警告",
			"危险",
			"前景色",
			"背景色",
			"表面色",
			"表单字段",
			"分隔线",
			"其他",
			"基础色",
			"如何使用颜色",
			"默认主题",
			"自定义颜色",
			"对比度审计",
		]) {
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
		expect(screen.getByText(VIOLET_SEED_HEX.toUpperCase())).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "主色 松绿" }));
		expect(screen.getByText("#059669")).toBeTruthy();
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

	it("主色选择只更新本页明暗预览，不写入项目根主题", () => {
		render(<PaletteGenerator />);
		const lightPreview = document.querySelector<HTMLElement>('[data-palette-preview="light"]');
		expect(lightPreview).toBeTruthy();
		const initialPreviewPrimary = lightPreview?.style.getPropertyValue("--primary-base");
		const initialRootPrimary =
			document.documentElement.style.getPropertyValue("--primary-base");

		fireEvent.click(screen.getByRole("button", { name: "主色 松绿" }));

		expect(lightPreview?.style.getPropertyValue("--primary-base")).not.toBe(
			initialPreviewPrimary,
		);
		expect(document.documentElement.style.getPropertyValue("--primary-base")).toBe(
			initialRootPrimary,
		);
		expect(screen.getAllByText(/受控预览/).length).toBeGreaterThanOrEqual(1);
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

		await waitFor(() => {
			const popover = screen.getByRole("dialog", {
				name: "--warning-hover 颜色定义",
			});
			expect(popover.textContent).toContain("--color-warning-hover:");
			expect(popover.textContent).toContain("var(--warning-foreground) 10%");
		});
	});

	it("如何使用颜色并列组件与 CSS 双示例", () => {
		render(<PaletteGenerator />);
		const componentCard = document.querySelector('[data-title="在组件中"] pre');
		expect(componentCard?.textContent).toContain('variant="primary"');
		expect(componentCard?.textContent).toContain("text-primary-base-foreground");
		const cssCard = document.querySelector('[data-title="在 CSS 文件中"] pre');
		expect(cssCard?.textContent).toContain("var(--primary-base)");
		expect(cssCard?.textContent).toContain("@apply bg-primary-base");
	});

	it("默认主题与自定义颜色展示真实主题源码", () => {
		render(<PaletteGenerator />);
		const violetCard = document.querySelector(
			'[data-title="@violet/ui/styles/palettes/violet.css"] pre',
		);
		expect(violetCard?.textContent).toContain(
			"--primary-base-ring: light-dark(oklch(0.53 0.205 286), oklch(0.72 0.148 286))",
		);
		const coralCard = document.querySelector(
			'[data-title="覆盖主色源 · palettes/coral.css"] pre',
		);
		expect(coralCard?.textContent).toContain(
			"--primary-base: light-dark(oklch(0.625 0.19 25), oklch(0.72 0.15 22))",
		);
		const siteTokensCard = document.querySelector(
			'[data-title="添加业务色 · styles/site-tokens.css"] pre',
		);
		expect(siteTokensCard?.textContent).toContain(
			"--paper: light-dark(oklch(0.976 0.012 85), oklch(0.23 0.012 70))",
		);
		expect(siteTokensCard?.textContent).toContain("--color-paper: var(--paper)");
	});

	it("HEX 文本输入框可直接驱动主色重算", () => {
		render(<PaletteGenerator />);
		const input = screen.getByDisplayValue(VIOLET_SEED_HEX);
		fireEvent.change(input, { target: { value: "#10b981" } });
		expect(screen.getAllByText("#10B981").length).toBeGreaterThanOrEqual(1);
	});
});
