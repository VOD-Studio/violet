import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { type UseRichTextInputReturn, useRichTextInput } from "../use-rich-text-input";

function Host({
	onChange,
	onReady,
}: {
	onChange: (value: string) => void;
	onReady: (input: UseRichTextInputReturn) => void;
}) {
	const input = useRichTextInput({ value: "前后", onChange });
	onReady(input);
	return (
		<>
			<div
				ref={input.contentRef}
				contentEditable
				data-testid="editor"
				suppressContentEditableWarning
			/>
			<button type="button">表情网格</button>
			<p data-testid="outside">外部正文</p>
		</>
	);
}

afterEach(() => {
	cleanup();
	window.getSelection()?.removeAllRanges();
});

it.each([
	true,
	false,
])("选择器聚焦时连续插入原文，不抢焦点（页面仍保留选区：%s）", (retainSelection) => {
	let input: UseRichTextInputReturn;
	const onChange = vi.fn();
	render(
		<Host
			onChange={onChange}
			onReady={(value) => {
				input = value;
			}}
		/>,
	);
	const editor = screen.getByTestId("editor");
	const range = document.createRange();
	range.setStart(editor.firstChild as Node, 1);
	range.collapse(true);
	const selection = window.getSelection();
	selection?.removeAllRanges();
	selection?.addRange(range);
	fireEvent(document, new Event("selectionchange"));
	const picker = screen.getByRole("button", { name: "表情网格" });
	picker.focus();
	if (!retainSelection) {
		selection?.removeAllRanges();
	}
	act(() => input.insertEmoji({ token: "(・ω・)", text: "(・ω・)" }));
	act(() => input.insertEmoji({ token: "[T_T]", text: "[T_T]" }));
	expect(onChange).toHaveBeenLastCalledWith("前(・ω・)[T_T]后");
	expect(document.activeElement).toBe(picker);
	expect(editor.querySelector("[data-emoji]")).toBeNull();
});

it("跨出编辑区的选区不能删除编辑器外部正文", () => {
	let input: UseRichTextInputReturn;
	const onChange = vi.fn();
	render(
		<Host
			onChange={onChange}
			onReady={(value) => {
				input = value;
			}}
		/>,
	);
	const editor = screen.getByTestId("editor");
	const outside = screen.getByTestId("outside");
	const range = document.createRange();
	range.setStart(editor.firstChild as Node, 1);
	range.setEnd(outside.firstChild as Node, 2);
	window.getSelection()?.addRange(range);
	fireEvent(document, new Event("selectionchange"));
	act(() => input.insertEmoji({ token: "(・ω・)", text: "(・ω・)" }));
	expect(outside.textContent).toBe("外部正文");
	expect(onChange).toHaveBeenLastCalledWith("前后(・ω・)");
});
