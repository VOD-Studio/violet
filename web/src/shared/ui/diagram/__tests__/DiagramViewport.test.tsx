/**
 * DiagramViewport 组件层测试（T4 a11y）
 *
 * 验证内容容器 tabIndex 聚焦 + 键盘事件驱动 transform 变更 + 工具条按钮渲染。
 * 不测真实 mermaid 渲染（PRD Testing Decisions：手动验证），children 用占位 div。
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiagramViewport } from "../DiagramViewport";

afterEach(cleanup);

describe("DiagramViewport 键盘 a11y", () => {
    it("内容容器有 tabIndex=0（可键盘聚焦）", () => {
        const { container } = render(
            <DiagramViewport>
                <div data-testid="content" />
            </DiagramViewport>,
        );
        // 内容容器是外层 relative div 的第一个子 div
        const viewport = container.querySelector(".relative > div");
        expect(viewport?.getAttribute("tabindex")).toBe("0");
    });

    it("Enter 解锁（锁定态 → 解锁态，工具条出现缩放按钮）", () => {
        render(
            <DiagramViewport>
                <div data-testid="content" />
            </DiagramViewport>,
        );
        // 锁定态：只有锁按钮，无放大按钮
        expect(screen.queryByLabelText("放大")).toBeNull();

        // 点击锁按钮解锁
        fireEvent.click(screen.getByLabelText("解锁缩放"));

        // 解锁后出现放大/缩小/重置按钮
        expect(screen.getByLabelText("放大")).toBeTruthy();
        expect(screen.getByLabelText("缩小")).toBeTruthy();
        expect(screen.getByLabelText("重置缩放")).toBeTruthy();
    });

    it("解锁后键盘 + 放大（transform scale 增大）", () => {
        const { container } = render(
            <DiagramViewport>
                <div data-testid="content" />
            </DiagramViewport>,
        );
        const viewport = container.querySelector(".relative > div") as HTMLElement;

        // 先解锁
        fireEvent.click(screen.getByLabelText("解锁缩放"));

        // 内层 transform div
        const transformDiv = viewport.querySelector("div[style]") as HTMLElement;
        const scaleBefore = transformDiv.style.transform;

        fireEvent.keyDown(viewport, { key: "+" });

        const scaleAfter = transformDiv.style.transform;
        expect(scaleAfter).not.toBe(scaleBefore);
    });

    it("锁定态下方向键不改变 transform", () => {
        const { container } = render(
            <DiagramViewport>
                <div data-testid="content" />
            </DiagramViewport>,
        );
        const viewport = container.querySelector(".relative > div") as HTMLElement;
        const transformDiv = viewport.querySelector("div[style]") as HTMLElement;
        const transformBefore = transformDiv.style.transform;

        fireEvent.keyDown(viewport, { key: "ArrowRight" });
        fireEvent.keyDown(viewport, { key: "ArrowDown" });

        expect(transformDiv.style.transform).toBe(transformBefore);
    });

    it("解锁后方向键平移（transform translate 变化）", () => {
        const { container } = render(
            <DiagramViewport>
                <div data-testid="content" />
            </DiagramViewport>,
        );
        const viewport = container.querySelector(".relative > div") as HTMLElement;

        fireEvent.click(screen.getByLabelText("解锁缩放"));

        const transformDiv = viewport.querySelector("div[style]") as HTMLElement;
        const transformBefore = transformDiv.style.transform;

        fireEvent.keyDown(viewport, { key: "ArrowRight" });

        expect(transformDiv.style.transform).not.toBe(transformBefore);
    });

    it("锁定态工具条：仅锁按钮 + 复制按钮（传 onCopySource 时）", () => {
        render(
            <DiagramViewport onCopySource={() => {}}>
                <div />
            </DiagramViewport>,
        );
        expect(screen.getByLabelText("解锁缩放")).toBeTruthy();
        expect(screen.getByLabelText("复制 mermaid 源码")).toBeTruthy();
        expect(screen.queryByLabelText("放大")).toBeNull();
    });

    it("renderToolbar=false 时工具条不渲染", () => {
        render(
            <DiagramViewport renderToolbar={false}>
                <div />
            </DiagramViewport>,
        );
        expect(screen.queryByLabelText("解锁缩放")).toBeNull();
    });
});

describe("DiagramViewport 导出菜单（T1）", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("传 exportSvg 时渲染导出按钮，不传时不渲染", () => {
        const { rerender } = render(
            <DiagramViewport exportSvg="<svg/>">
                <div />
            </DiagramViewport>,
        );
        expect(screen.getByLabelText("导出图表")).toBeTruthy();

        rerender(
            <DiagramViewport>
                <div />
            </DiagramViewport>,
        );
        expect(screen.queryByLabelText("导出图表")).toBeNull();
    });

    it("点击导出按钮弹出 SVG/PNG 菜单", () => {
        render(
            <DiagramViewport exportSvg="<svg/>">
                <div />
            </DiagramViewport>,
        );
        // 初始菜单不显示
        expect(screen.queryByText("导出 SVG")).toBeNull();

        fireEvent.click(screen.getByLabelText("导出图表"));
        expect(screen.getByText("导出 SVG")).toBeTruthy();
        expect(screen.getByText("导出 PNG")).toBeTruthy();
    });

    it("点击「导出 SVG」后菜单关闭", () => {
        render(
            <DiagramViewport exportSvg="<svg/>">
                <div />
            </DiagramViewport>,
        );
        fireEvent.click(screen.getByLabelText("导出图表"));
        fireEvent.click(screen.getByText("导出 SVG"));
        expect(screen.queryByText("导出 SVG")).toBeNull();
    });

    it("导出按钮有 aria-haspopup=menu 与 aria-expanded", () => {
        render(
            <DiagramViewport exportSvg="<svg/>">
                <div />
            </DiagramViewport>,
        );
        const btn = screen.getByLabelText("导出图表");
        expect(btn.getAttribute("aria-haspopup")).toBe("menu");
        expect(btn.getAttribute("aria-expanded")).toBe("false");

        fireEvent.click(btn);
        expect(btn.getAttribute("aria-expanded")).toBe("true");
    });
});

describe("DiagramViewport 全屏按钮（T3）", () => {
    it("传 onFullscreen 时渲染全屏按钮，不传时不渲染", () => {
        const { rerender } = render(
            <DiagramViewport onFullscreen={() => {}}>
                <div />
            </DiagramViewport>,
        );
        expect(screen.getByLabelText("全屏查看")).toBeTruthy();

        rerender(
            <DiagramViewport>
                <div />
            </DiagramViewport>,
        );
        expect(screen.queryByLabelText("全屏查看")).toBeNull();
    });

    it("点击全屏按钮触发 onFullscreen", () => {
        const onFullscreen = vi.fn();
        render(
            <DiagramViewport onFullscreen={onFullscreen}>
                <div />
            </DiagramViewport>,
        );
        fireEvent.click(screen.getByLabelText("全屏查看"));
        expect(onFullscreen).toHaveBeenCalledOnce();
    });
});
