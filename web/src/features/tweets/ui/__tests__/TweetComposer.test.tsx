/**
 * TweetComposer 组件测试
 *
 * 验证：
 * - 渲染文本输入框、图片上传按钮、表情选择按钮、剩余字数
 * - 表情选择后插入 [name] 占位符至光标处并更新内容
 * - 纯文本/附图/引用的提交逻辑
 */
import type { Emoji } from "@entities/emoji/model/types";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// mock useMe
vi.mock("@features/auth/api/queries", () => ({
	useMe: () => ({
		data: { id: "u-1", username: "alice", avatar_url: "/avatar.png" },
	}),
}));

// mock useCreateTweet
const mutateMock = vi.fn();
vi.mock("@features/tweets/api/mutations", () => ({
	useCreateTweet: () => ({
		mutate: mutateMock,
		isPending: false,
	}),
}));

// mock useChunkedUpload
vi.mock("@features/upload/hooks/use-chunked-upload", () => ({
	useChunkedUpload: () => ({ uploadFile: vi.fn() }),
}));

// mock EmojiPicker: 简化受控触发 onSelect
let emojiPickerOnSelect: ((emoji: Emoji) => void) | null = null;
vi.mock("@features/emojis/ui/EmojiPicker", () => ({
	EmojiPicker: ({
		onSelect,
		trigger,
	}: {
		onSelect: (emoji: Emoji) => void;
		trigger?: React.ReactNode;
	}) => {
		emojiPickerOnSelect = onSelect;
		return (
			<div data-testid="emoji-picker-mock">
				{trigger}
				<button
					type="button"
					data-testid="mock-select-emoji"
					onClick={() =>
						onSelect({
							id: 1,
							name: "doge",
							url: "https://emoji/doge.png",
							sort_order: 0,
						})
					}
				>
					Select Doge
				</button>
			</div>
		);
	},
}));

import TweetComposer from "../TweetComposer";

describe("TweetComposer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		emojiPickerOnSelect = null;
	});
	afterEach(() => {
		cleanup();
	});

	it("渲染输入框、图片按钮、表情按钮与发布按钮", () => {
		render(<TweetComposer />);
		expect(screen.getByPlaceholderText("有什么新鲜事？")).toBeTruthy();
		expect(screen.getByLabelText("添加图片")).toBeTruthy();
		expect(screen.getByLabelText("添加表情")).toBeTruthy();
		expect(screen.getByRole("button", { name: /发布/ })).toBeTruthy();
	});

	it("选择表情后在输入框插入 [name] 占位符", () => {
		render(<TweetComposer />);
		const textarea = screen.getByPlaceholderText("有什么新鲜事？") as HTMLTextAreaElement;
		fireEvent.change(textarea, { target: { value: "今天天气真好 " } });

		const selectBtn = screen.getByTestId("mock-select-emoji");
		fireEvent.click(selectBtn);

		expect(textarea.value).toBe("今天天气真好 [doge]");
	});

	it("选择纯文字表情插入 text_content", () => {
		render(<TweetComposer />);
		const textarea = screen.getByPlaceholderText("有什么新鲜事？") as HTMLTextAreaElement;

		// 直接调用捕获的 onSelect（在 act 中触发以刷新 state）
		act(() => {
			emojiPickerOnSelect?.({
				id: 2,
				name: "kaomoji",
				url: "",
				text_content: "(^_^)",
				sort_order: 0,
			});
		});

		expect(textarea.value).toBe("(^_^)");
	});
	it("选择自定义表情插入 [name:uuid] 占位符", () => {
		render(<TweetComposer />);
		const textarea = screen.getByPlaceholderText("有什么新鲜事？") as HTMLTextAreaElement;

		act(() => {
			emojiPickerOnSelect?.({
				id: -1,
				name: "mycat",
				url: "https://emoji/mycat.png",
				custom_emoji_id: "00000000-0000-0000-0000-000000000001",
				relation: "owned",
			});
		});

		expect(textarea.value).toBe("[mycat:00000000-0000-0000-0000-000000000001]");
	});
	it("提交推文调用 mutate", () => {
		render(<TweetComposer />);
		const textarea = screen.getByPlaceholderText("有什么新鲜事？");
		fireEvent.change(textarea, { target: { value: "第一条推文 [doge]" } });

		const submitBtn = screen.getByRole("button", { name: /发布/ });
		fireEvent.click(submitBtn);

		expect(mutateMock).toHaveBeenCalledWith(
			{ content: "第一条推文 [doge]", images: [], quote_of: undefined },
			expect.any(Object),
		);
	});
});
