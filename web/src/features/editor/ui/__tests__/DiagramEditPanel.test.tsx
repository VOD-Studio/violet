/**
 * DiagramEditPanel 测试（T5 组件层单测补全）
 *
 * 弹层面板的展示契约：textarea 受控、预览状态（svg/error/loading 沿用上一帧/
 * 空源码占位）、Esc 关闭、删除按钮、textarea 行数随源码行数自适应。
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MermaidRenderState } from "../../hooks/useMermaidSvg";
import { DiagramEditPanel } from "../DiagramEditPanel";

afterEach(cleanup);

const okRender: MermaidRenderState = { svg: "<svg/>", error: null, loading: false };
const errorRender: MermaidRenderState = { svg: null, error: "Parse error", loading: false };
const loadingRender: MermaidRenderState = { svg: null, error: null, loading: true };
/** loading 但沿用上一帧 SVG（防闪烁） */
const loadingWithStaleSvg: MermaidRenderState = {
    svg: "<svg class='stale'/>",
    error: null,
    loading: true,
};

describe("DiagramEditPanel 预览状态", () => {
    it("render.svg 非空时展示 SVG（dangerouslySetInnerHTML）", () => {
        const { container } = render(
            <DiagramEditPanel
                source="graph TD"
                render={okRender}
                onChange={() => {}}
                onClose={() => {}}
                onDelete={() => {}}
            />,
        );
        const preview = container.querySelector(".diagram-preview");
        expect(preview?.innerHTML).toContain("<svg");
    });

    it("render.error 且无 svg 时内联显示错误信息（便于作者修）", () => {
        render(
            <DiagramEditPanel
                source="bad"
                render={errorRender}
                onChange={() => {}}
                onClose={() => {}}
                onDelete={() => {}}
            />,
        );
        expect(screen.getByText("Parse error")).toBeTruthy();
    });

    it("loading 且有上一帧 svg 时仍展示 SVG + 叠加 spinner（防闪烁）", () => {
        const { container } = render(
            <DiagramEditPanel
                source="graph TD"
                render={loadingWithStaleSvg}
                onChange={() => {}}
                onClose={() => {}}
                onDelete={() => {}}
            />,
        );
        // 上一帧 SVG 仍展示
        const preview = container.querySelector(".diagram-preview");
        expect(preview?.innerHTML).toContain("stale");
        // 叠加半透明 spinner
        expect(container.querySelector(".animate-spin")).toBeTruthy();
    });

    it("空源码 + 非 loading 时显示占位提示", () => {
        render(
            <DiagramEditPanel
                source=""
                render={{ svg: null, error: null, loading: false }}
                onChange={() => {}}
                onClose={() => {}}
                onDelete={() => {}}
            />,
        );
        expect(screen.getByText("输入 mermaid 源码查看预览")).toBeTruthy();
    });

    it("有源码 + loading + 无上一帧 svg 时显示「渲染中…」", () => {
        render(
            <DiagramEditPanel
                source="graph TD"
                render={loadingRender}
                onChange={() => {}}
                onClose={() => {}}
                onDelete={() => {}}
            />,
        );
        expect(screen.getByText("渲染中…")).toBeTruthy();
    });
});

describe("DiagramEditPanel 交互", () => {
    it("textarea 受控：输入触发 onChange", () => {
        const onChange = vi.fn();
        render(
            <DiagramEditPanel
                source="graph TD"
                render={okRender}
                onChange={onChange}
                onClose={() => {}}
                onDelete={() => {}}
            />,
        );
        const textarea = screen.getByRole("textbox");
        fireEvent.change(textarea, { target: { value: "flowchart LR" } });
        expect(onChange).toHaveBeenCalledWith("flowchart LR");
    });

    it("textarea Esc 触发 onClose", () => {
        const onClose = vi.fn();
        render(
            <DiagramEditPanel
                source="graph TD"
                render={okRender}
                onChange={() => {}}
                onClose={onClose}
                onDelete={() => {}}
            />,
        );
        fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
        expect(onClose).toHaveBeenCalledOnce();
    });

    it("删除按钮点击触发 onDelete", () => {
        const onDelete = vi.fn();
        render(
            <DiagramEditPanel
                source="graph TD"
                render={okRender}
                onChange={() => {}}
                onClose={() => {}}
                onDelete={onDelete}
            />,
        );
        fireEvent.click(screen.getByText("删除"));
        expect(onDelete).toHaveBeenCalledOnce();
    });
});

describe("DiagramEditPanel textarea 行数自适应", () => {
    it("短源码（1 行）→ rows 至少 3", () => {
        render(
            <DiagramEditPanel
                source="graph TD"
                render={okRender}
                onChange={() => {}}
                onClose={() => {}}
                onDelete={() => {}}
            />,
        );
        const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
        expect(Number(textarea.rows)).toBe(3);
    });

    it("长源码（10 行）→ rows 等于行数", () => {
        const source = Array.from({ length: 10 }, (_, i) => `    N${i} --> N${i + 1}`).join("\n");
        render(
            <DiagramEditPanel
                source={source}
                render={okRender}
                onChange={() => {}}
                onClose={() => {}}
                onDelete={() => {}}
            />,
        );
        const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
        expect(Number(textarea.rows)).toBe(10);
    });

    it("超长源码（15 行）→ rows 上限 12", () => {
        const source = Array.from({ length: 15 }, (_, i) => `    N${i} --> N${i + 1}`).join("\n");
        render(
            <DiagramEditPanel
                source={source}
                render={okRender}
                onChange={() => {}}
                onClose={() => {}}
                onDelete={() => {}}
            />,
        );
        const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
        expect(Number(textarea.rows)).toBe(12);
    });
});
