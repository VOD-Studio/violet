/**
 * RichCommentInput 组件测试
 *
 * 验证核心行为：
 * - 渲染 contentEditable 输入区 + 工具栏
 * - 输入触发 onChange 回调
 * - Cmd/Ctrl+Enter 触发 onSubmit
 * - compact 模式减小尺寸
 * - disabled 时不可编辑
 *
 * contentEditable 在 jsdom 中有限制，手动设置 innerHTML + 触发 input 事件模拟用户输入。
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@features/emojis/api/queries", () => ({
    useAllEmojis: () =>({ data: [], isLoading: false }),
}));

import { RichCommentInput } from "../RichCommentInput";

describe("RichCommentInput", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        cleanup();
    });

    it("渲染 contentEditable 输入区 + 工具栏", () => {
        render(
            <RichCommentInput value="" onChange={() => {}} />,
        );
        const editor = screen.getByRole("textbox", { name: "评论内容" });
        expect(editor).toBeTruthy();
        expect(editor.getAttribute("contentEditable")).toBe("true");
    });

    it("输入触发 onChange 回调", () => {
        const onChange = vi.fn();
        const { container } = render(
            <RichCommentInput value="" onChange={onChange} />,
        );
        const editor = container.querySelector('[contenteditable="true"]') as HTMLElement;
        expect(editor).toBeTruthy();
        editor.textContent = "你好世界";
        fireEvent.input(editor);
        expect(onChange).toHaveBeenCalledWith("你好世界");
    });

    it("Cmd+Enter 触发 onSubmit", () => {
        const onSubmit = vi.fn();
        const { container } = render(
            <RichCommentInput value="" onChange={() => {}} onSubmit={onSubmit} />,
        );
        const editor = container.querySelector('[contenteditable="true"]') as HTMLElement;
        fireEvent.keyDown(editor, { key: "Enter", metaKey: true });
        expect(onSubmit).toHaveBeenCalledOnce();
    });

    it("Ctrl+Enter 触发 onSubmit", () => {
        const onSubmit = vi.fn();
        const { container } = render(
            <RichCommentInput value="" onChange={() => {}} onSubmit={onSubmit} />,
        );
        const editor = container.querySelector('[contenteditable="true"]') as HTMLElement;
        fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true });
        expect(onSubmit).toHaveBeenCalledOnce();
    });

    it("compact 模式应用更小的 padding", () => {
        const { container } = render(
            <RichCommentInput value="" onChange={() => {}} compact />,
        );
        const editor = container.querySelector('[contenteditable="true"]') as HTMLElement;
        expect(editor.className).toContain("min-h-10");
    });

    it("disabled 时 contentEditable 不可编辑", () => {
        const { container } = render(
            <RichCommentInput value="" onChange={() => {}} disabled />,
        );
        const editor = container.querySelector('[contenteditable="false"]') as HTMLElement;
        expect(editor).toBeTruthy();
    });

    it("enableEmoji=false 时不渲染 emoji 按钮", () => {
        const { container } = render(
            <RichCommentInput value="" onChange={() => {}} enableEmoji={false} />,
        );
        const emojiBtn = container.querySelector('button[aria-label="添加表情"]');
        expect(emojiBtn).toBeNull();
    });
});
