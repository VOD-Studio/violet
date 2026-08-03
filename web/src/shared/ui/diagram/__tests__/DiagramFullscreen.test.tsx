/**
 * DiagramFullscreen 组件测试（T3）
 *
 * 覆盖：Portal 挂载到 document.body、Esc / 遮罩点击 / 关闭按钮关闭、
 * 打开时聚焦模态容器、role=dialog + aria-modal 语义。
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiagramFullscreen } from "../DiagramFullscreen";

afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
});

describe("DiagramFullscreen 挂载与语义", () => {
    it("Portal 挂载到 document.body（不在容器内）", () => {
        const { container } = render(
            <div data-testid="parent">
                <DiagramFullscreen svg="<svg/>" label="测试图" onClose={() => {}} />
            </div>,
        );
        // dialog 不在 parent 容器内（Portal 到 body）
        const dialog = screen.getByRole("dialog");
        expect(container.contains(dialog)).toBe(false);
        expect(document.body.contains(dialog)).toBe(true);
    });

    it("role=dialog + aria-modal=true", () => {
        render(<DiagramFullscreen svg="<svg/>" label="流程图" onClose={() => {}} />);
        const dialog = screen.getByRole("dialog");
        expect(dialog.getAttribute("aria-modal")).toBe("true");
        expect(dialog.getAttribute("aria-label")).toBe("流程图");
    });

    it("SVG 内容渲染（dangerouslySetInnerHTML）", () => {
        render(<DiagramFullscreen svg='<svg id="fs-svg"/>' label="测试" onClose={() => {}} />);
        expect(document.body.querySelector("#fs-svg")).toBeTruthy();
    });
});

describe("DiagramFullscreen 关闭", () => {
    it("关闭按钮点击触发 onClose", () => {
        const onClose = vi.fn();
        render(<DiagramFullscreen svg="<svg/>" label="测试" onClose={onClose} />);
        fireEvent.click(screen.getByLabelText("关闭全屏"));
        expect(onClose).toHaveBeenCalledOnce();
    });

    it("Esc 键触发 onClose", () => {
        const onClose = vi.fn();
        render(<DiagramFullscreen svg="<svg/>" label="测试" onClose={onClose} />);
        fireEvent.keyDown(document, { key: "Escape" });
        expect(onClose).toHaveBeenCalledOnce();
    });

    it("点击遮罩空白触发 onClose", () => {
        const onClose = vi.fn();
        render(<DiagramFullscreen svg="<svg/>" label="测试" onClose={onClose} />);
        const dialog = screen.getByRole("dialog");
        // 模拟点击遮罩本身（非子元素）
        fireEvent.click(dialog);
        expect(onClose).toHaveBeenCalledOnce();
    });

    it("点击内容区不触发 onClose（仅遮罩空白关闭）", () => {
        const onClose = vi.fn();
        render(<DiagramFullscreen svg="<svg/>" label="测试" onClose={onClose} />);
        // 点击内容区的关闭按钮（子元素）——不应通过遮罩点击关闭
        const closeBtn = screen.getByLabelText("关闭全屏");
        fireEvent.click(closeBtn);
        // onClose 由按钮自身触发（1 次），但不是因为遮罩点击
        expect(onClose).toHaveBeenCalledOnce();
    });
});

describe("DiagramFullscreen 焦点管理", () => {
    it("打开时聚焦模态容器", () => {
        render(<DiagramFullscreen svg="<svg/>" label="测试" onClose={() => {}} />);
        const dialog = screen.getByRole("dialog");
        expect(document.activeElement).toBe(dialog);
    });
});
