/**
 * CommentForm 组件测试
 *
 * 验证双模式切换（PRD-0001）：
 *   - 登录态：直接渲染 textarea，不渲染昵称/邮箱/验证码输入
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
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CommentForm } from "../CommentForm";

describe("CommentForm", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        cleanup();
    });

    it("登录态：渲染 textarea，不渲染昵称/邮箱/验证码", () => {
        render(<CommentForm postId="p1" isLoggedIn={true} />);
        // textarea 存在
        expect(screen.queryByPlaceholderText("写下你的评论…")).toBeTruthy();
        // 匿名字段不渲染
        expect(screen.queryByPlaceholderText("昵称 *")).toBeNull();
        expect(screen.queryByPlaceholderText("邮箱 *")).toBeNull();
        expect(screen.queryByText("发送验证码")).toBeNull();
        // 登录引导不渲染（已是登录态）
        expect(screen.queryByText("登录参与完整讨论")).toBeNull();
    });

    it("匿名态：渲染昵称/邮箱输入 + 发送验证码 + 登录引导", () => {
        const { container } = render(<CommentForm postId="p1" isLoggedIn={false} />);
        expect(screen.queryByPlaceholderText("昵称 *")).toBeTruthy();
        expect(screen.queryByPlaceholderText("邮箱 *")).toBeTruthy();
        // ResendButton 渲染了「发送验证码」button（直接查 DOM 文本，避开 queryByText 的 normalize 问题）
        const buttons = container.querySelectorAll("button");
        const sendBtn = Array.from(buttons).find((b) => b.textContent === "发送验证码");
        expect(sendBtn).toBeTruthy();
        expect(screen.queryByText("登录参与完整讨论")).toBeTruthy();
        // 匿名 placeholder（用 queryByPlaceholderText，不是 queryByText）
        expect(screen.queryByPlaceholderText(/写下你的留言/)).toBeTruthy();
    });

    it("匿名态未发送验证码时，提交按钮禁用", () => {
        render(<CommentForm postId="p1" isLoggedIn={false} />);
        // 表单内提交按钮：用 type=submit 精确定位
        const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement;
        expect(submitBtn).toBeTruthy();
        expect(submitBtn.disabled).toBe(true);
    });

    it("登录态提交按钮默认启用（仅内容必填，HTML required）", () => {
        render(<CommentForm postId="p1" isLoggedIn={true} />);
        const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement;
        expect(submitBtn).toBeTruthy();
        expect(submitBtn.disabled).toBe(false);
    });
});
