/**
 * LatexSourceField 交互测试
 *
 * 契约：反斜杠触发建议、前缀过滤、键盘导航与接受、
 * Esc 分层（先关下拉再关弹层）、接受后光标落在占位符内。
 */
import { act, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { LatexSourceField } from "../LatexSourceField";

/** 受控容器：模拟 MathEditPanel 的父级回写 */
function Harness({
    displayMode = false,
    initial = "",
    onClose = () => {},
}: {
    displayMode?: boolean;
    initial?: string;
    onClose?: () => void;
}) {
    const [latex, setLatex] = useState(initial);
    return (
        <LatexSourceField
            latex={latex}
            displayMode={displayMode}
            onChange={setLatex}
            onClose={onClose}
        />
    );
}

/** 输入文本并把光标移到末尾（jsdom 的 change 不移动 selection） */
function typeText(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
    fireEvent.change(el, { target: { value } });
    act(() => el.setSelectionRange(value.length, value.length));
}

function getField(container: HTMLElement) {
    const field = container.querySelector("input,textarea");
    if (!field) throw new Error("无输入框");
    return field as HTMLInputElement | HTMLTextAreaElement;
}

describe("LatexSourceField", () => {
    it("输入反斜杠弹出建议列表", () => {
        const { container } = render(<Harness />);
        typeText(getField(container), "\\");
        expect(container.querySelectorAll("li").length).toBeGreaterThan(0);
    });

    it("前缀过滤：\\sq 首项为 \\sqrt", () => {
        const { container } = render(<Harness />);
        typeText(getField(container), "\\sq");
        expect(container.querySelector("li")?.textContent).toContain("\\sqrt");
    });

    it("Enter 接受高亮项并替换查询，光标落在占位符内", () => {
        const { container } = render(<Harness />);
        const field = getField(container);
        typeText(field, "\\sq");
        fireEvent.keyDown(field, { key: "Enter" });
        expect(field.value).toBe("\\sqrt{}");
        expect(field.selectionStart).toBe(6);
    });

    it("ArrowDown 移动高亮后接受第二项", () => {
        const { container } = render(<Harness />);
        const field = getField(container);
        typeText(field, "\\si");
        const second = container.querySelectorAll("li")[1]?.textContent ?? "";
        fireEvent.keyDown(field, { key: "ArrowDown" });
        fireEvent.keyDown(field, { key: "Enter" });
        // 第二项命令名出现在替换结果中
        const accepted = second.match(/\\[a-zA-Z]+/)?.[0];
        expect(accepted).toBeTruthy();
        expect(field.value.startsWith(accepted as string)).toBe(true);
    });

    it("Tab 同样接受补全", () => {
        const { container } = render(<Harness />);
        const field = getField(container);
        typeText(field, "\\fr");
        fireEvent.keyDown(field, { key: "Tab" });
        expect(field.value).toBe("\\frac{}{}");
        expect(field.selectionStart).toBe(6);
    });

    it("Esc 先关下拉（不关弹层），再 Esc 才 onClose", () => {
        const onClose = vi.fn();
        const { container } = render(<Harness onClose={onClose} />);
        const field = getField(container);
        typeText(field, "\\sq");
        expect(container.querySelectorAll("li").length).toBeGreaterThan(0);
        fireEvent.keyDown(field, { key: "Escape" });
        expect(container.querySelectorAll("li").length).toBe(0);
        expect(onClose).not.toHaveBeenCalled();
        fireEvent.keyDown(field, { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("点击建议项接受补全", () => {
        const { container } = render(<Harness />);
        const field = getField(container);
        typeText(field, "\\fr");
        const first = container.querySelector("li button");
        if (!first) throw new Error("无建议项");
        fireEvent.click(first);
        expect(field.value).toBe("\\frac{}{}");
    });

    it("块级模式 Enter 换行不接受也不关闭（无下拉时）", () => {
        const onClose = vi.fn();
        const { container } = render(<Harness displayMode={true} onClose={onClose} />);
        const field = getField(container);
        fireEvent.keyDown(field, { key: "Enter" });
        expect(onClose).not.toHaveBeenCalled();
    });

    it("非命令上下文不显示建议", () => {
        const { container } = render(<Harness />);
        typeText(getField(container), "x + y");
        expect(container.querySelectorAll("li").length).toBe(0);
    });
});
