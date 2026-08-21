/**
 * DiagramBlock 组件层测试（T5）
 *
 * 覆盖：首加载占位面板（无 spinner）、成功渲染 SVG + container 挂 fade 类、
 * 失败错误提示行（流式融入：左细线 + 单行文案 + 折叠源码）、复制按钮反馈、
 * 主题订阅重渲（注册表统一 await）、aria-label 语义化。
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runThemeRerender } from "@/shared/lib/theme-rerender";
import { DiagramBlock } from "../DiagramBlock";
import { renderMermaid } from "../render-mermaid";

afterEach(() => {
	cleanup();
	// 主题测试注入的 dark class 需复位，避免污染后续测试的 readCurrentTheme()
	document.documentElement.classList.remove("dark");
});

// renderMermaid mock：DiagramBlock 只用 renderMermaid 函数（DiagramTheme/RenderMermaidResult 是 type-only 编译后擦除，无需在 mock factory 提供）
vi.mock("../render-mermaid", () => ({
	renderMermaid: vi.fn().mockResolvedValue({ svg: "<svg data-testid='mock-svg'/>" }),
}));
beforeEach(() => {
	vi.mocked(renderMermaid).mockClear();
	vi.mocked(renderMermaid).mockResolvedValue({ svg: "<svg data-testid='mock-svg'/>" });
	// clipboard mock
	Object.defineProperty(navigator, "clipboard", {
		value: { writeText: vi.fn().mockResolvedValue(undefined) },
		configurable: true,
	});
});

describe("DiagramBlock 加载与渲染", () => {
	it("首加载占位面板显示（无旋转 spinner）", () => {
		// renderMermaid 不 resolve（pending）；项目 lib=ES2022 无 withResolvers
		vi.mocked(renderMermaid).mockReturnValue(
			new Promise<never>(() => {
				/* never resolves */
			}),
		);
		const { container } = render(<DiagramBlock format="mermaid" source="graph TD" />);
		// 旋转 spinner 已去除：避免「空白 → 转圈 → 图」三段式割裂
		expect(container.querySelector(".animate-spin")).toBeNull();
		// 占位面板：图标 pulse（animate-pulse）+ bg-muted/40 背景
		expect(container.querySelector(".animate-pulse")).toBeTruthy();
	});

	it("渲染成功后 SVG 写入容器并挂 fade-in 动画类", async () => {
		vi.mocked(renderMermaid).mockResolvedValue({ svg: "<svg id='result'/>" });
		const { container } = render(<DiagramBlock format="mermaid" source="graph TD" />);
		await waitFor(() => {
			expect(container.querySelector("#result")).toBeTruthy();
		});
		// 首次成功挂上 animate-diagram-enter（一次，后续主题切换保留旧帧不重播）
		const img = container.querySelector("[role='img']");
		expect(img?.className).toContain("animate-diagram-enter");
	});

	it("渲染失败降级为 shiki 高亮源码块（与 CodeCard 同视觉）", async () => {
		vi.mocked(renderMermaid).mockResolvedValue({ error: "syntax error" });
		const { container } = render(<DiagramBlock format="mermaid" source="bad source" />);
		// 不显示 "图表渲染失败" 装饰文字——失败 = 退化回代码呈现，源码自身是内容
		await waitFor(() => {
			expect(screen.queryByText("图表渲染失败")).toBeNull();
		});
		// 源码块：深色代码块视觉族（顶栏语言标签 + 高亮源码）
		const top = container.querySelector(".bg-\\[\\#24292e\\]");
		expect(top).toBeTruthy();
		// 源码出现在代码块内（shiki 高亮前 fallback 纯文本，检测到即可）
		await waitFor(() => {
			const allCode = container.querySelectorAll("code");
			const has = Array.from(allCode).some((c) => c.textContent === "bad source");
			expect(has).toBe(true);
		});
	});
});

describe("DiagramBlock aria-label 语义化", () => {
	it("源码含 title 关键字 → aria-label 取标题", async () => {
		render(
			<DiagramBlock
				format="mermaid"
				source={"flowchart TD\n    title: 订单流程\n    A --> B"}
			/>,
		);
		await waitFor(() => {
			expect(screen.getByRole("img")).toBeTruthy();
		});
		expect(screen.getByRole("img").getAttribute("aria-label")).toBe("订单流程");
	});

	it("源码无标题信息 → aria-label 降级「Mermaid 图表」", async () => {
		render(<DiagramBlock format="mermaid" source="flowchart TD\n    A --> B" />);
		await waitFor(() => {
			expect(screen.getByRole("img")).toBeTruthy();
		});
		expect(screen.getByRole("img").getAttribute("aria-label")).toBe("Mermaid 图表");
	});
});

describe("DiagramBlock 复制按钮", () => {
	it("点击复制按钮调用 clipboard.writeText 并切换为已复制态", async () => {
		render(<DiagramBlock format="mermaid" source="graph TD" />);
		// 等渲染完成（工具条出现）
		await waitFor(() => {
			expect(screen.getByLabelText("复制 mermaid 源码")).toBeTruthy();
		});

		const copyBtn = screen.getByLabelText("复制 mermaid 源码");
		fireEvent.click(copyBtn);

		await waitFor(() => {
			expect(navigator.clipboard.writeText).toHaveBeenCalledWith("graph TD");
		});
		// 复制后 aria-label/title 切换为「已复制」
		await waitFor(() => {
			expect(screen.getByTitle("已复制")).toBeTruthy();
		});
	});
});

describe("DiagramBlock 主题订阅重渲", () => {
	it("主题切换经注册表触发重渲，且用新主题参数", async () => {
		render(<DiagramBlock format="mermaid" source="graph TD" />);
		await waitFor(() => {
			expect(vi.mocked(renderMermaid)).toHaveBeenCalledTimes(1);
		});

		// 模拟主题切换 VT update 回调的行为：apply 后 await 注册表（target 显式传）
		await runThemeRerender("dark");

		await waitFor(() => {
			expect(vi.mocked(renderMermaid)).toHaveBeenCalledTimes(2);
		});
		expect(vi.mocked(renderMermaid)).toHaveBeenLastCalledWith("graph TD", "dark");
	});
});
