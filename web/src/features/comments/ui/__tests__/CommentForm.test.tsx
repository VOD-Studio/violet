/**
 * CommentForm 组件测试
 *
 * 验证双模式切换（PRD-0001）：
 *   - 登录态：直接渲染输入框，不渲染昵称/邮箱/验证码输入
 *   - 匿名态：渲染昵称 + 邮箱 + 「发送验证码」按钮 + 登录引导
 *
 * mock 范式复制 admin-posts/ui/__tests__/PostEditorLayout.test.tsx；
 * 断言风格跟随项目惯例（.length/.toBeNull/.toBeTruthy，无 jest-dom）。
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock 必须在 import 被测模块前（hoist）
vi.mock("@features/comments/api/mutations", () => ({
    useCreateComment: () => ({ mutate: vi.fn(), isPending: false }),
    useSendCommentCode: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@features/auth/model/login-dialog-store", () => ({
    useLoginDialogStore: () => ({ open: vi.fn() }),
}));
vi.mock("@features/emojis/api/queries", () => ({
    useAllEmojis: () => ({ data: [], isLoading: false }),
}));
vi.mock("@features/upload/hooks/use-chunked-upload", () => ({
    useChunkedUpload: () => ({ uploadFile: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CommentForm } from "../CommentForm";

describe("CommentForm", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        cleanup();
    });

    it("登录态：渲染输入框，不渲染昵称/邮箱/验证码", () => {
        render(<CommentForm postId="p1" isLoggedIn={true} />);
        const editor = screen.getByRole("textbox", { name: "评论内容" });
        expect(editor).toBeTruthy();
        expect(editor.getAttribute("data-placeholder")).toBe("写下你的评论…");
        expect(screen.queryByPlaceholderText("昵称 *")).toBeNull();
        expect(screen.queryByPlaceholderText("邮箱 *")).toBeNull();
        expect(screen.queryByText("发送验证码")).toBeNull();
        expect(screen.queryByText("登录参与完整讨论")).toBeNull();
    });

    it("匿名态：渲染昵称/邮箱输入 + 发送验证码 + 登录引导", () => {
        const { container } = render(<CommentForm postId="p1" isLoggedIn={false} />);
        expect(screen.queryByPlaceholderText("昵称 *")).toBeTruthy();
        expect(screen.queryByPlaceholderText("邮箱 *")).toBeTruthy();
        const buttons = container.querySelectorAll("button");
        const sendBtn = Array.from(buttons).find((b) => b.textContent === "发送验证码");
        expect(sendBtn).toBeTruthy();
        expect(screen.queryByText("登录参与完整讨论")).toBeTruthy();
        const editor = screen.getByRole("textbox", { name: "评论内容" });
        expect(editor.getAttribute("data-placeholder")).toMatch(/写下你的留言/);
    });

    it("匿名态未发送验证码时，提交按钮禁用", () => {
        render(<CommentForm postId="p1" isLoggedIn={false} />);
        const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement;
        expect(submitBtn).toBeTruthy();
        expect(submitBtn.disabled).toBe(true);
    });

    it("登录态提交按钮默认启用", () => {
        render(<CommentForm postId="p1" isLoggedIn={true} />);
        const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement;
        expect(submitBtn).toBeTruthy();
        expect(submitBtn.disabled).toBe(false);
    });
});
