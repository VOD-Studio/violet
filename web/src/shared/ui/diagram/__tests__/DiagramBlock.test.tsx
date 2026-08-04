/**
 * DiagramBlock 组件层测试（T5）
 *
 * 覆盖：加载态 spinner、成功渲染 SVG 写入、失败降级 <details>、
 * 复制按钮反馈、主题 MutationObserver 触发重渲、aria-label 语义化。
 *
 * 不测真实 mermaid 渲染（PRD Testing Decisions：手动验证），renderMermaid 全 mock。
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    it("初始加载态显示 spinner（aria-live=polite）", () => {
        // renderMermaid 不 resolve（pending）；项目 lib=ES2022 无 withResolvers
        vi.mocked(renderMermaid).mockReturnValue(
            new Promise<never>(() => {
                /* never resolves */
            }),
        );
        const { container } = render(<DiagramBlock format="mermaid" source="graph TD" />);
        expect(container.querySelector('[aria-live="polite"]')).toBeTruthy();
        expect(container.querySelector(".animate-spin")).toBeTruthy();
    });

    it("渲染成功后 SVG 写入容器", async () => {
        vi.mocked(renderMermaid).mockResolvedValue({ svg: "<svg id='result'/>" });
        const { container } = render(<DiagramBlock format="mermaid" source="graph TD" />);
        await waitFor(() => {
            expect(container.querySelector("#result")).toBeTruthy();
        });
    });

    it("根容器带 data-type=diagram-block（批注拦截选择器依赖）", () => {
        const { container } = render(<DiagramBlock format="mermaid" source="graph TD" />);
        expect(container.firstElementChild?.getAttribute("data-type")).toBe("diagram-block");
    });

    it("渲染失败显示降级占位 + <details> 折叠源码", async () => {
        vi.mocked(renderMermaid).mockResolvedValue({ error: "syntax error" });
        const { container } = render(<DiagramBlock format="mermaid" source="bad source" />);
        await waitFor(() => {
            expect(screen.getByText("图表渲染失败")).toBeTruthy();
        });
        // 失败降级是 <details> 结构（无 JS 也可展开，PRD 降级决策）
        const details = container.querySelector("details");
        expect(details).toBeTruthy();
        expect(details?.querySelector("summary")?.textContent).toContain("查看源码");
        expect(details?.querySelector("code")?.textContent).toBe("bad source");
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

describe("DiagramBlock 主题 MutationObserver", () => {
    it("documentElement.classList 变化触发重新渲染", async () => {
        render(<DiagramBlock format="mermaid" source="graph TD" />);
        await waitFor(() => {
            expect(vi.mocked(renderMermaid)).toHaveBeenCalledTimes(1);
        });

        // 模拟切暗色主题：注入 dark class
        document.documentElement.classList.add("dark");

        await waitFor(() => {
            expect(vi.mocked(renderMermaid)).toHaveBeenCalledTimes(2);
        });
    });
});
