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
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockUploadFile } = vi.hoisted(() => ({ mockUploadFile: vi.fn() }));

vi.mock("@features/emojis/api/queries", () => ({
	useAllEmojis: () => ({ data: [], isLoading: false }),
}));
vi.mock("@features/upload/hooks/use-chunked-upload", () => ({
	useChunkedUpload: () => ({ uploadFile: mockUploadFile }),
}));

import { type PictureInput, RichCommentInput } from "../RichCommentInput";

/** 受控包装：inlineImages 依赖 value 真正回灌才能驱动退格剔除等效果，镜像 chat 的用法。 */
function Controlled({ onImagesChange }: { onImagesChange: (images: PictureInput[]) => void }) {
	const [value, setValue] = useState("");
	return (
		<RichCommentInput
			value={value}
			onChange={setValue}
			enableImage
			inlineImages
			onImagesChange={onImagesChange}
		/>
	);
}

describe("RichCommentInput", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => {
		cleanup();
	});

	it("渲染 contentEditable 输入区 + 工具栏", () => {
		render(<RichCommentInput value="" onChange={() => {}} />);
		const editor = screen.getByRole("textbox", { name: "评论内容" });
		expect(editor).toBeTruthy();
		expect(editor.getAttribute("contentEditable")).toBe("true");
	});

	it("输入触发 onChange 回调", () => {
		const onChange = vi.fn();
		const { container } = render(<RichCommentInput value="" onChange={onChange} />);
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
	it("submitOnEnter=true 时普通 Enter 触发 onSubmit", () => {
		const onSubmit = vi.fn();
		const { container } = render(
			<RichCommentInput value="" onChange={() => {}} onSubmit={onSubmit} submitOnEnter />,
		);
		const editor = container.querySelector('[contenteditable="true"]') as HTMLElement;
		fireEvent.keyDown(editor, { key: "Enter" });
		expect(onSubmit).toHaveBeenCalledOnce();
	});

	it("submitOnEnter=true 时 Shift+Enter 不触发 onSubmit", () => {
		const onSubmit = vi.fn();
		const { container } = render(
			<RichCommentInput value="" onChange={() => {}} onSubmit={onSubmit} submitOnEnter />,
		);
		const editor = container.querySelector('[contenteditable="true"]') as HTMLElement;
		fireEvent.keyDown(editor, { key: "Enter", shiftKey: true });
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("compact 模式应用更小的 padding", () => {
		const { container } = render(<RichCommentInput value="" onChange={() => {}} compact />);
		const editor = container.querySelector('[contenteditable="true"]') as HTMLElement;
		expect(editor.className).toContain("min-h-10");
	});

	it("disabled 时 contentEditable 不可编辑", () => {
		const { container } = render(<RichCommentInput value="" onChange={() => {}} disabled />);
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

describe("inlineImages", () => {
	beforeEach(() => {
		mockUploadFile.mockReset();
	});
	afterEach(() => {
		cleanup();
	});

	it("选择图片后立即插入行内 uploading 占位节点，不进入独立缩略图行", async () => {
		// 项目 TS target 为 ES2022，Promise.withResolvers（ES2024）不可用，此处需要
		// 一个永不 settle 的 promise 冻结在 uploading 态，用不到 resolve/reject。
		const pendingUpload = new Promise<never>(() => {});
		mockUploadFile.mockImplementation(() => pendingUpload);
		const { container } = render(<Controlled onImagesChange={() => {}} />);
		const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
		const file = new File(["binary"], "photo.png", { type: "image/png" });

		fireEvent.change(fileInput, { target: { files: [file] } });

		await waitFor(() => {
			expect(container.querySelector('[data-image-status="uploading"]')).toBeTruthy();
		});
		// inlineImages 模式下没有独立缩略图行，也就没有它的删除按钮。
		expect(container.querySelector('button[aria-label="删除图片"]')).toBeNull();
	});

	it("上传成功后原地替换为最终图片节点，并把结果通过 onImagesChange 上报", async () => {
		mockUploadFile.mockResolvedValue({
			file_id: "media-1",
			url: "https://cdn.example.com/media-1.png",
			width: 100,
			height: 80,
		});
		const onImagesChange = vi.fn();
		const { container } = render(<Controlled onImagesChange={onImagesChange} />);
		const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
		const file = new File(["binary"], "photo.png", { type: "image/png" });

		fireEvent.change(fileInput, { target: { files: [file] } });

		await waitFor(() => {
			expect(onImagesChange).toHaveBeenLastCalledWith([
				expect.objectContaining({
					id: "media-1",
					url: "https://cdn.example.com/media-1.png",
				}),
			]);
		});
		const node = container.querySelector('[data-image-status="done"]') as HTMLImageElement;
		expect(node).toBeTruthy();
		expect(node.src).toBe("https://cdn.example.com/media-1.png");
	});

	it("上传失败后原地替换为错误节点，点击移除后不再出现在 onImagesChange 结果里", async () => {
		mockUploadFile.mockRejectedValue(new Error("boom"));
		const onImagesChange = vi.fn();
		const { container } = render(<Controlled onImagesChange={onImagesChange} />);
		const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
		const file = new File(["binary"], "photo.png", { type: "image/png" });

		fireEvent.change(fileInput, { target: { files: [file] } });

		await waitFor(() => {
			expect(container.querySelector('[data-image-status="error"]')).toBeTruthy();
		});
		const errorNode = container.querySelector('[data-image-status="error"]') as HTMLElement;

		fireEvent.click(errorNode);

		await waitFor(() => {
			expect(container.querySelector("[data-image]")).toBeNull();
		});
		expect(onImagesChange).toHaveBeenLastCalledWith([]);
	});

	it("多图一起选择：onImagesChange 按图片在文字流中的顺序输出", async () => {
		mockUploadFile.mockImplementation(async (file: File) =>
			file.name === "a.png"
				? { file_id: "media-a", url: "https://cdn.example.com/a.png", width: 1, height: 1 }
				: { file_id: "media-b", url: "https://cdn.example.com/b.png", width: 1, height: 1 },
		);
		const onImagesChange = vi.fn();
		const { container } = render(<Controlled onImagesChange={onImagesChange} />);
		const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
		const fileA = new File(["a"], "a.png", { type: "image/png" });
		const fileB = new File(["b"], "b.png", { type: "image/png" });

		fireEvent.change(fileInput, { target: { files: [fileA, fileB] } });

		await waitFor(() => {
			expect(onImagesChange).toHaveBeenLastCalledWith([
				expect.objectContaining({ id: "media-a" }),
				expect.objectContaining({ id: "media-b" }),
			]);
		});
	});
});
