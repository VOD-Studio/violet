import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Button } from "@violet/ui";
import { createRef, type Ref, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RichTextInput, type RichTextInputHandle, type RichTextInputProps } from "../RichTextInput";

interface HostProps {
	inputRef?: Ref<RichTextInputHandle>;
	initialValue?: string;
	customToolbar?: boolean;
	disabled?: boolean;
	layout?: RichTextInputProps["layout"];
	onChange?: (value: string) => void;
	onSubmit?: () => void;
}

function Host({
	inputRef,
	initialValue = "前后",
	customToolbar = true,
	disabled = false,
	layout = "inline",
	onChange,
	onSubmit,
}: HostProps) {
	const [value, setValue] = useState(initialValue);
	return (
		<RichTextInput
			ref={inputRef}
			disabled={disabled}
			enableImage
			initialImages={[{ id: "photo", url: "/photo.png", width: 1, height: 1, size: 1 }]}
			inlineImages
			layout={layout}
			mentionCandidates={[{ id: "bob", username: "bob", displayName: "Bob" }]}
			onChange={(next) => {
				setValue(next);
				onChange?.(next);
			}}
			onSubmit={onSubmit}
			renderEmojiPicker={({ trigger }) => trigger}
			renderInlineActions={
				customToolbar
					? ({ attachImage, canAttachImage, startMention, emojiPicker }) => ({
							start: (
								<Button
									disabled={!canAttachImage}
									onClick={attachImage ?? undefined}
								>
									附件
								</Button>
							),
							end: (
								<>
									<Button
										disabled={!startMention}
										onClick={startMention ?? undefined}
									>
										提及
									</Button>
									{emojiPicker}
								</>
							),
						})
					: undefined
			}
			submitOnEnter
			toolbarEnd={<Button onClick={onSubmit}>提交</Button>}
			uploadFile={vi.fn()}
			value={value}
		/>
	);
}

afterEach(() => {
	cleanup();
	window.getSelection()?.removeAllRanges();
});

describe("inline toolbar consumer contract", () => {
	it("默认布局保留图片入口与末尾操作，不自动增加提及入口", () => {
		render(<Host customToolbar={false} />);
		expect(screen.getByRole("button", { name: "上传图片" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "添加表情" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "提交" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "提及" })).toBeNull();
	});

	it("自定义工具栏只影响 inline，field 保留原有工具栏", () => {
		render(<Host layout="field" />);
		expect(screen.getByRole("button", { name: "上传图片" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "附件" })).toBeNull();
		expect(screen.queryByRole("button", { name: "提及" })).toBeNull();
	});

	it("附件入口仍打开同一原生文件选择框", () => {
		const { container } = render(<Host />);
		const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
		const click = vi.spyOn(fileInput, "click");
		fireEvent.click(screen.getByRole("button", { name: "附件" }));
		expect(click).toHaveBeenCalledOnce();
	});

	it("提及入口恢复保存的选区并保留光标两侧正文", () => {
		const onChange = vi.fn();
		render(<Host onChange={onChange} />);
		const editor = screen.getByRole("textbox");
		const range = document.createRange();
		range.setStart(editor.firstChild as Node, 1);
		range.collapse(true);
		const selection = window.getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);
		fireEvent(document, new Event("selectionchange"));
		screen.getByRole("button", { name: "提及" }).focus();
		selection?.removeAllRanges();

		fireEvent.click(screen.getByRole("button", { name: "提及" }));
		expect(document.activeElement).toBe(editor);
		expect(editor.textContent).toBe("前\u00a0@后");
		expect(screen.getByRole("option", { name: /Bob/ })).toBeTruthy();
		fireEvent.click(screen.getByRole("option", { name: /Bob/ }));
		expect(onChange).toHaveBeenLastCalledWith("前\u00a0@(bob:bob)\u00a0后");
	});

	it("Shift+Enter 和 IME 不选择提及也不提交，普通 Enter 才补全", () => {
		const onSubmit = vi.fn();
		render(<Host initialValue="" onSubmit={onSubmit} />);
		const editor = screen.getByRole("textbox");
		fireEvent.click(screen.getByRole("button", { name: "提及" }));
		fireEvent.keyDown(editor, { key: "Enter", shiftKey: true });
		fireEvent.keyDown(editor, { key: "Enter", isComposing: true });
		expect(editor.querySelector("[data-mention]")).toBeNull();
		expect(onSubmit).not.toHaveBeenCalled();
		fireEvent.keyDown(editor, { key: "Enter" });
		expect(editor.querySelector("[data-mention]")?.textContent).toBe("@Bob");
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("命令入口可前置命令，同时保留原草稿与图片节点", () => {
		const inputRef = createRef<RichTextInputHandle>();
		const onChange = vi.fn();
		render(<Host initialValue="下雨天![img:photo]" inputRef={inputRef} onChange={onChange} />);
		const editor = screen.getByRole("textbox");
		const image = editor.querySelector("[data-image]");
		act(() => {
			expect(inputRef.current?.replaceSlashQuery("/song\u00a0")).toBe(false);
			expect(
				inputRef.current?.insertSlashCommand("/song\u00a0", {
					id: "bot",
					username: "saber",
					displayName: "Saber",
				}),
			).toBe(true);
		});
		expect(onChange).toHaveBeenLastCalledWith("@(saber:bot) /song\u00a0下雨天![img:photo]");
		expect(editor.querySelector("[data-image]")).toBe(image);
		expect(document.activeElement).toBe(editor);
	});

	it("禁用态不允许工具栏修改正文", () => {
		const inputRef = createRef<RichTextInputHandle>();
		const onChange = vi.fn();
		render(<Host disabled inputRef={inputRef} onChange={onChange} />);
		fireEvent.click(screen.getByRole("button", { name: "提及" }));
		act(() => {
			expect(inputRef.current?.insertSlashCommand("/song\u00a0")).toBe(false);
		});
		expect(screen.getByRole("textbox").textContent).toBe("前后");
		expect(onChange).not.toHaveBeenCalled();
	});

	it("自定义工具栏内移动焦点保留候选，离开输入区才关闭", () => {
		render(
			<>
				<Host initialValue="" />
				<button type="button">输入区外</button>
			</>,
		);
		fireEvent.click(screen.getByRole("button", { name: "提及" }));
		act(() => screen.getByRole("button", { name: "提及" }).focus());
		expect(screen.getByRole("option", { name: /Bob/ })).toBeTruthy();
		act(() => screen.getByRole("button", { name: "输入区外" }).focus());
		expect(screen.queryByRole("option")).toBeNull();
	});
});
