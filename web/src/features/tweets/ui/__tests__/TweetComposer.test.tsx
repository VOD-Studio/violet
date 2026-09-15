/**
 * TweetComposer 组件测试
 *
 * 验证：
 * - 渲染文本输入框、图片上传按钮、表情选择按钮、剩余字数
 * - 表情选择后插入 [name] 占位符至光标处并更新内容
 * - 纯文本/附图/引用的提交逻辑
 */
import type { Emoji } from "@entities/emoji/model/types";
import {
	act,
	cleanup,
	createEvent,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { toast } from "sonner";
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

const uploadFileMock = vi.fn();
vi.mock("@features/upload/hooks/use-chunked-upload", () => ({
	useChunkedUpload: () => ({ uploadFile: uploadFileMock }),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

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
		uploadFileMock.mockReset().mockResolvedValue({ url: "/pasted.png" });
		vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
		vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
		emojiPickerOnSelect = null;
	});
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
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

	it("粘贴图片后上传并随推文提交，上传期间不可发布", async () => {
		let finishUpload!: (result: { url: string }) => void;
		uploadFileMock.mockReturnValueOnce(
			new Promise((resolve) => {
				finishUpload = resolve;
			}),
		);
		render(<TweetComposer />);
		const textarea = screen.getByRole("textbox");
		fireEvent.change(textarea, { target: { value: "配图" } });
		const file = new File(["png"], "clipboard.png", { type: "image/png" });
		const event = createEvent.paste(textarea, {
			clipboardData: { files: [file], getData: () => "" },
		});
		fireEvent(textarea, event);
		expect(event.defaultPrevented).toBe(true);
		expect(uploadFileMock).toHaveBeenCalledWith(file, expect.any(Function));
		expect(screen.getByLabelText("移除图片")).toBeTruthy();
		expect((screen.getByRole("button", { name: "发布" }) as HTMLButtonElement).disabled).toBe(
			true,
		);
		await act(async () => finishUpload({ url: "/pasted.png" }));
		fireEvent.click(screen.getByRole("button", { name: "发布" }));
		expect(mutateMock).toHaveBeenCalledWith(
			{ content: "配图", images: ["/pasted.png"], quote_of: undefined },
			expect.any(Object),
		);
	});

	it.each([
		{ files: [] },
		{ files: [new File(["text"], "note.txt", { type: "text/plain" })] },
	])("无图片的剪贴板保留原生粘贴行为（%j）", ({ files }) => {
		render(<TweetComposer />);
		const textarea = screen.getByRole("textbox");
		const event = createEvent.paste(textarea, {
			clipboardData: { files, getData: () => "粘贴文字" },
		});
		fireEvent(textarea, event);
		expect(event.defaultPrevented).toBe(false);
		expect(uploadFileMock).not.toHaveBeenCalled();
	});

	it("图文混合粘贴上传图片并保留原生文本插入", async () => {
		render(<TweetComposer />);
		const event = createEvent.paste(screen.getByRole("textbox"), {
			clipboardData: {
				files: [new File(["png"], "clipboard.png", { type: "image/png" })],
				getData: () => "图片说明",
			},
		});
		await act(async () => {
			fireEvent(screen.getByRole("textbox"), event);
		});
		expect(event.defaultPrevented).toBe(false);
		expect(uploadFileMock).toHaveBeenCalledTimes(1);
	});

	it("上传期间重复粘贴不会突破四张限制，移除后可以继续添加", async () => {
		let finishUpload!: (result: { url: string }) => void;
		uploadFileMock.mockReturnValueOnce(
			new Promise((resolve) => {
				finishUpload = resolve;
			}),
		);
		render(<TweetComposer />);
		const textarea = screen.getByRole("textbox");
		const file = new File(["png"], "clipboard.png", { type: "image/png" });
		const paste = (files: File[]) =>
			fireEvent.paste(textarea, {
				clipboardData: { files, getData: () => "" },
			});
		paste(Array.from({ length: 5 }, () => file));
		paste([file]);
		expect(uploadFileMock).toHaveBeenCalledTimes(1);
		expect(toast.error).toHaveBeenCalledWith("请等待当前图片上传完成");
		await act(async () => finishUpload({ url: "/pasted.png" }));
		expect(uploadFileMock).toHaveBeenCalledTimes(4);
		expect(screen.getAllByLabelText("移除图片")).toHaveLength(4);
		paste([file]);
		expect(uploadFileMock).toHaveBeenCalledTimes(4);
		expect(toast.error).toHaveBeenCalledWith("最多 4 张图");
		fireEvent.click(screen.getAllByLabelText("移除图片")[0]);
		await act(async () => {
			paste([file]);
		});
		expect(uploadFileMock).toHaveBeenCalledTimes(5);
	});

	it("粘贴超大图片沿用大小限制，上传失败后仍可再次粘贴", async () => {
		render(<TweetComposer />);
		const file = new File(["png"], "large.png", { type: "image/png" });
		Object.defineProperty(file, "size", { value: 10 * 1024 * 1024 + 1 });
		const paste = (image: File) =>
			fireEvent.paste(screen.getByRole("textbox"), {
				clipboardData: { files: [image], getData: () => "" },
			});
		paste(file);
		expect(uploadFileMock).not.toHaveBeenCalled();
		expect(toast.error).toHaveBeenCalledWith("large.png 超过 10MB");
		uploadFileMock.mockRejectedValueOnce(new Error("offline"));
		const valid = new File(["png"], "valid.png", { type: "image/png" });
		paste(valid);
		await waitFor(() => expect(screen.getByText("上传失败")).toBeTruthy());
		await act(async () => {
			paste(valid);
		});
		expect(uploadFileMock).toHaveBeenCalledTimes(2);
	});
});
