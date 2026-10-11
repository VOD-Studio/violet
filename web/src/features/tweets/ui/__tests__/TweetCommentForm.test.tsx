/**
 * TweetCommentForm 快捷键提交测试：⌘/Ctrl+Enter 等同点击提交按钮，按钮禁用时不提交。
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createMutate, mutationState } = vi.hoisted(() => ({
	createMutate: vi.fn(),
	mutationState: { isPending: false },
}));

vi.mock("../../api/mutations", () => ({
	useCreateTweetComment: () => ({ mutate: createMutate, isPending: mutationState.isPending }),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@features/emojis/api/queries", () => ({
	useAllEmojis: () => ({ data: [], isLoading: false }),
}));
vi.mock("@features/upload/hooks/use-chunked-upload", () => ({
	useChunkedUpload: () => ({ uploadFile: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { TweetCommentForm } from "../TweetCommentForm";

function typeAndSubmit(text: string) {
	const editor = screen.getByRole("textbox");
	editor.textContent = text;
	fireEvent.input(editor);
	fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true });
}

describe("TweetCommentForm", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mutationState.isPending = false;
	});
	afterEach(() => {
		cleanup();
	});

	it("⌘/Ctrl+Enter 提交回复", () => {
		render(<TweetCommentForm tweetId="t1" parentId="c0" isLoggedIn compact />);
		typeAndSubmit("回复内容");
		expect(createMutate).toHaveBeenCalledTimes(1);
		expect(createMutate.mock.calls[0][0]).toMatchObject({ body: "回复内容", parent_id: "c0" });
	});

	it("发送中按钮禁用时 ⌘/Ctrl+Enter 不重复提交", () => {
		mutationState.isPending = true;
		render(<TweetCommentForm tweetId="t1" isLoggedIn />);
		typeAndSubmit("评论内容");
		expect(createMutate).not.toHaveBeenCalled();
	});
});
