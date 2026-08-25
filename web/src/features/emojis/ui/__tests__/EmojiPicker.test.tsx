/**
 * EmojiPicker 组件测试
 *
 * 验证：
 * - 加载态显示加载中
 * - 按分组标签展示表情
 * - 点击表情触发 onSelect 并关闭浮层
 * - 未登录不展示「我的表情」tab；登录后展示我传的/收藏来的，点击触发 onSelect
 * - 上传流程：选文件 → 命名 → 确认，依次调用上传与创建 mutation
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const groups = [
	{
		id: 1,
		name: "默认",
		source: "system",
		sort_order: 0,
		is_enabled: true,
		emojis: [
			{ id: 1, name: "赞", url: "/1.png" },
			{ id: 2, name: "笑", url: "/2.png", text_content: "😄" },
		],
	},
];

const useAllEmojis = vi.fn();
const uploadEmojiMutateAsync = vi.fn();
vi.mock("@features/emojis/api/queries", () => ({
	useAllEmojis: () => useAllEmojis(),
}));
vi.mock("@features/emojis/api/mutations", () => ({
	useUploadEmoji: () => ({ mutateAsync: uploadEmojiMutateAsync, isPending: false }),
}));

const useSessionStore = vi.fn();
vi.mock("@shared/api/session", () => ({
	useSessionStore: () => useSessionStore(),
}));

const useMyCustomEmojis = vi.fn();
const createCustomEmojiMutateAsync = vi.fn();
vi.mock("@features/customemoji/api/queries", () => ({
	useMyCustomEmojis: () => useMyCustomEmojis(),
	useCreateCustomEmoji: () => ({ mutateAsync: createCustomEmojiMutateAsync, isPending: false }),
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...args: unknown[]) => toastError(...args) } }));

import { EmojiPicker } from "../EmojiPicker";

describe("EmojiPicker", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		useSessionStore.mockReturnValue(false);
		useMyCustomEmojis.mockReturnValue({ data: undefined, isLoading: false });
	});
	afterEach(() => {
		cleanup();
	});

	it("加载态显示加载中", () => {
		useAllEmojis.mockReturnValue({ data: undefined, isLoading: true });
		render(<EmojiPicker onSelect={vi.fn()} />);
		fireEvent.click(screen.getByLabelText("添加表情"));
		expect(screen.getByText("加载中…")).toBeTruthy();
	});

	it("展示分组与表情，点击触发 onSelect", () => {
		const onSelect = vi.fn();
		useAllEmojis.mockReturnValue({ data: groups, isLoading: false });
		render(<EmojiPicker onSelect={onSelect} />);

		fireEvent.click(screen.getByLabelText("添加表情"));

		expect(screen.getByText("默认")).toBeTruthy();
		const buttons = document.querySelectorAll("button[title]");
		const zan = Array.from(buttons).find((b) => b.getAttribute("title") === "赞");
		expect(zan).toBeTruthy();

		fireEvent.click(zan as Element);
		expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 1, name: "赞" }));
	});

	it("已选中的表情禁用且不可点击", () => {
		const onSelect = vi.fn();
		useAllEmojis.mockReturnValue({ data: groups, isLoading: false });
		render(<EmojiPicker onSelect={onSelect} selectedIds={new Set([1])} />);

		fireEvent.click(screen.getByLabelText("添加表情"));

		const buttons = document.querySelectorAll("button[title]");
		const zan = Array.from(buttons).find((b) => b.getAttribute("title")?.startsWith("赞"));
		expect(zan).toBeTruthy();
		expect((zan as HTMLButtonElement).disabled).toBe(true);

		fireEvent.click(zan as Element);
		expect(onSelect).not.toHaveBeenCalled();
	});

	it("未登录不展示我的表情 tab", () => {
		useSessionStore.mockReturnValue(false);
		render(<EmojiPicker onSelect={vi.fn()} />);

		fireEvent.click(screen.getByLabelText("添加表情"));

		expect(screen.queryByTitle("我的表情")).toBeNull();
	});

	it("登录后打开默认选中我的表情 tab，渲染我传的与收藏来的", () => {
		const onSelect = vi.fn();
		useAllEmojis.mockReturnValue({ data: groups, isLoading: false });
		useSessionStore.mockReturnValue(true);
		useMyCustomEmojis.mockReturnValue({
			data: {
				owned: [
					{
						id: -1,
						name: "mycat",
						url: "/mycat.png",
						custom_emoji_id: "e-1",
						relation: "owned",
					},
				],
				favorited: [
					{
						id: -2,
						name: "fav",
						url: "/fav.png",
						custom_emoji_id: "e-2",
						relation: "favorited",
					},
				],
			},
			isLoading: false,
		});
		render(<EmojiPicker onSelect={onSelect} />);

		fireEvent.click(screen.getByLabelText("添加表情"));

		expect(screen.getByText("我传的")).toBeTruthy();
		expect(screen.getByText("收藏来的")).toBeTruthy();

		const mycat = screen.getByAltText("mycat");
		expect(mycat.getAttribute("data-custom-emoji-id")).toBe("e-1");
		expect(mycat.getAttribute("data-relation")).toBe("owned");

		fireEvent.click(mycat);
		expect(onSelect).toHaveBeenCalledWith(
			expect.objectContaining({ custom_emoji_id: "e-1", relation: "owned" }),
		);
	});

	it("文件名含禁用字符时默认名清洗后再命名", async () => {
		useAllEmojis.mockReturnValue({ data: groups, isLoading: false });
		useSessionStore.mockReturnValue(true);
		useMyCustomEmojis.mockReturnValue({ data: { owned: [], favorited: [] }, isLoading: false });

		render(<EmojiPicker onSelect={vi.fn()} />);
		fireEvent.click(screen.getByLabelText("添加表情"));

		const file = new File(["x"], "my_cat (2).png", { type: "image/png" });
		const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
		await act(async () => {
			fireEvent.change(fileInput, { target: { files: [file] } });
		});

		const nameInput = screen.getByPlaceholderText("给表情起个名字") as HTMLInputElement;
		expect(nameInput.value).toBe("mycat (2)");
	});

	it("名称含 markdown 语法字符时拦截上传并提示", async () => {
		useAllEmojis.mockReturnValue({ data: groups, isLoading: false });
		useSessionStore.mockReturnValue(true);
		useMyCustomEmojis.mockReturnValue({ data: { owned: [], favorited: [] }, isLoading: false });

		render(<EmojiPicker onSelect={vi.fn()} />);
		fireEvent.click(screen.getByLabelText("添加表情"));

		const file = new File(["x"], "ok.png", { type: "image/png" });
		const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
		await act(async () => {
			fireEvent.change(fileInput, { target: { files: [file] } });
		});

		const nameInput = screen.getByPlaceholderText("给表情起个名字") as HTMLInputElement;
		fireEvent.change(nameInput, { target: { value: "a_b" } });
		fireEvent.click(screen.getByText("上传"));

		expect(toastError).toHaveBeenCalledWith("表情名称不能包含 _ * ~ ` [ ] \\ 字符");
		expect(uploadEmojiMutateAsync).not.toHaveBeenCalled();
		expect(createCustomEmojiMutateAsync).not.toHaveBeenCalled();
	});

	it("上传流程：选文件后进入命名态，确认后依次调用上传与创建", async () => {
		useAllEmojis.mockReturnValue({ data: groups, isLoading: false });
		useSessionStore.mockReturnValue(true);
		useMyCustomEmojis.mockReturnValue({ data: { owned: [], favorited: [] }, isLoading: false });
		uploadEmojiMutateAsync.mockResolvedValue({ url: "/uploads/emoji/x.png" });
		createCustomEmojiMutateAsync.mockResolvedValue({
			id: "e-3",
			name: "myfile",
			url: "/uploads/emoji/x.png",
		});

		render(<EmojiPicker onSelect={vi.fn()} />);
		fireEvent.click(screen.getByLabelText("添加表情"));
		fireEvent.click(screen.getByTitle("我的表情"));

		const file = new File(["x"], "myfile.png", { type: "image/png" });
		const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
		await act(async () => {
			fireEvent.change(fileInput, { target: { files: [file] } });
		});

		const nameInput = screen.getByPlaceholderText("给表情起个名字") as HTMLInputElement;
		expect(nameInput.value).toBe("myfile");

		fireEvent.click(screen.getByText("上传"));

		await waitFor(() => {
			expect(uploadEmojiMutateAsync).toHaveBeenCalledWith(file);
			expect(createCustomEmojiMutateAsync).toHaveBeenCalledWith({
				name: "myfile",
				url: "/uploads/emoji/x.png",
			});
		});
	});
});
