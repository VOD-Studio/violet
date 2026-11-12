/**
 * CommentForm 组件测试
 *
 * 验证双模式切换（PRD-0001）：
 *   - 登录态：直接渲染输入框，不渲染昵称/邮箱/验证码输入
 *   - 匿名态：渲染昵称 + 邮箱 + 「发送验证码」按钮 + 验证码提示
 *
 * mock 范式复制 admin-posts/ui/__tests__/PostEditorLayout.test.tsx；
 * 断言风格跟随项目惯例（.length/.toBeNull/.toBeTruthy，无 jest-dom）。
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createMutate, sendCode } = vi.hoisted(() => ({
	createMutate: vi.fn(),
	sendCode: vi.fn(),
}));

// vi.mock 必须在 import 被测模块前（hoist）
vi.mock("@features/comments/api/mutations", () => ({
	useCreateComment: () => ({ mutate: createMutate, isPending: false }),
	useSendCommentCode: () => ({ mutateAsync: sendCode, isPending: false }),
}));
vi.mock("@shared/api/login-dialog-store", () => ({
	useLoginDialogStore: () => ({ open: vi.fn() }),
}));
vi.mock("@features/emojis/api/queries", () => ({
	useAllEmojis: () => ({ data: [], isLoading: false }),
}));
vi.mock("@features/customemoji/api/queries", () => ({
	useMyCustomEmojis: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("@features/upload/hooks/use-chunked-upload", () => ({
	useChunkedUpload: () => ({ uploadFile: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CommentForm } from "../CommentForm";

describe("CommentForm", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		sendCode.mockResolvedValue(null);
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

	it("匿名态：渲染昵称/邮箱输入 + 发送验证码 + 验证码提示", () => {
		const { container } = render(<CommentForm postId="p1" isLoggedIn={false} />);
		expect(screen.queryByPlaceholderText("昵称 *")).toBeTruthy();
		expect(screen.queryByPlaceholderText("邮箱 *")).toBeTruthy();
		const buttons = container.querySelectorAll("button");
		const sendBtn = Array.from(buttons).find((b) => b.textContent === "发送验证码");
		expect(sendBtn).toBeTruthy();
		expect(screen.queryByText("匿名留言需邮箱验证码，审核通过后登录可见")).toBeTruthy();
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

	it("⌘/Ctrl+Enter 提交评论，且不显示快捷键提示", () => {
		render(<CommentForm postId="p1" isLoggedIn={true} parentId="c0" />);
		const editor = screen.getByRole("textbox", { name: "评论内容" });
		editor.textContent = "你好";
		fireEvent.input(editor);
		fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true });
		expect(createMutate).toHaveBeenCalledTimes(1);
		expect(createMutate.mock.calls[0][0]).toMatchObject({ body: "你好", parent_id: "c0" });
		expect(screen.queryByText(/Ctrl \+ Enter/)).toBeNull();
	});

	it("提交按钮禁用时 ⌘/Ctrl+Enter 不提交", () => {
		render(<CommentForm postId="p1" isLoggedIn={false} />);
		const editor = screen.getByRole("textbox", { name: "评论内容" });
		editor.textContent = "匿名留言";
		fireEvent.input(editor);
		fireEvent.keyDown(editor, { key: "Enter", metaKey: true });
		expect(createMutate).not.toHaveBeenCalled();
	});

	it("发码失败可立即重试，成功后才展示有名称的验证码组", async () => {
		sendCode.mockRejectedValueOnce(new Error("网络中断"));
		render(<CommentForm postId="p1" isLoggedIn={false} />);
		fireEvent.change(screen.getByRole("textbox", { name: "邮箱" }), {
			target: { value: "reader@example.com" },
		});
		const send = screen.getByRole("button", { name: "发送验证码" });
		fireEvent.click(send);
		await waitFor(() => expect((send as HTMLButtonElement).disabled).toBe(false));
		expect(screen.queryByRole("group", { name: "邮箱验证码" })).toBeNull();
		fireEvent.click(send);
		const group = await screen.findByRole("group", { name: "邮箱验证码" });
		expect(within(group).getAllByRole("textbox")).toHaveLength(6);
		expect(sendCode).toHaveBeenCalledTimes(2);
	});

	it("切换邮箱后，旧邮箱迟到的成功结果不会展开验证码或冷却新邮箱", async () => {
		const oldRequest = Promise.withResolvers<null>();
		sendCode.mockReturnValueOnce(oldRequest.promise);
		render(<CommentForm postId="p1" isLoggedIn={false} />);
		const email = screen.getByRole("textbox", { name: "邮箱" });
		fireEvent.change(email, { target: { value: "old@example.com" } });
		fireEvent.click(screen.getByRole("button", { name: "发送验证码" }));
		fireEvent.change(email, { target: { value: "new@example.com" } });
		await act(async () => oldRequest.resolve(null));
		expect(screen.queryByRole("group", { name: "邮箱验证码" })).toBeNull();
		const send = screen.getByRole("button", { name: "发送验证码" });
		expect((send as HTMLButtonElement).disabled).toBe(false);
		fireEvent.click(send);
		await screen.findByRole("group", { name: "邮箱验证码" });
		expect(sendCode).toHaveBeenLastCalledWith({ email: "new@example.com" });
	});

	it("换邮箱立即清除旧验证码，不能将其用于新邮箱提交", async () => {
		render(<CommentForm postId="p1" isLoggedIn={false} />);
		const email = screen.getByRole("textbox", { name: "邮箱" });
		fireEvent.change(email, { target: { value: "old@example.com" } });
		fireEvent.click(screen.getByRole("button", { name: "发送验证码" }));
		const group = await screen.findByRole("group", { name: "邮箱验证码" });
		fireEvent.paste(within(group).getByRole("textbox", { name: "第 1 位" }), {
			clipboardData: { getData: () => "482951" },
		});
		expect((screen.getByRole("button", { name: "发送" }) as HTMLButtonElement).disabled).toBe(
			false,
		);
		fireEvent.change(email, { target: { value: "new@example.com" } });
		expect((screen.getByRole("button", { name: "发送" }) as HTMLButtonElement).disabled).toBe(
			true,
		);
		fireEvent.click(screen.getByRole("button", { name: "发送验证码" }));
		const newGroup = await screen.findByRole("group", { name: "邮箱验证码" });
		expect(
			within(newGroup)
				.getAllByRole("textbox")
				.every((input) => (input as HTMLInputElement).value === ""),
		).toBe(true);
	});
});
