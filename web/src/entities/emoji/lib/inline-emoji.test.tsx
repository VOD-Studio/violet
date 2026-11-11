import {
	type UseRichTextInputReturn,
	useRichTextInput,
} from "@shared/ui/rich-text-input/use-rich-text-input";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Emoji } from "../model/types";
import { toInlineEmoji } from "./inline-emoji";

function insertEmoji(emoji: Emoji) {
	let controller: UseRichTextInputReturn;
	const onChange = vi.fn();
	function Editor() {
		controller = useRichTextInput({ value: "", onChange });
		return <div ref={controller.contentRef} contentEditable suppressContentEditableWarning />;
	}
	const view = render(<Editor />);
	act(() => controller.insertEmoji(toInlineEmoji(emoji)));
	return { ...view, onChange };
}

afterEach(() => {
	cleanup();
	window.getSelection()?.removeAllRanges();
});

it.each([
	{ gif: "https://example.com/smile.gif", expected: "https://example.com/smile.gif" },
	{ gif: "", expected: "https://example.com/smile.png" },
])("图片表情优先显示动图，空地址时使用静态图：$gif", ({ gif, expected }) => {
	const { container, onChange } = insertEmoji({
		id: 1,
		name: "[smile]",
		url: "https://example.com/smile.png",
		gif_url: gif,
	});
	expect(container.querySelector("img")?.getAttribute("src")).toBe(expected);
	expect(onChange).toHaveBeenLastCalledWith("[smile]");
});

it("颜文字忽略附带图片，保留带方括号的原文", () => {
	const { container, onChange } = insertEmoji({
		id: 2,
		name: "哭泣",
		url: "https://example.com/cry.png",
		gif_url: "https://example.com/cry.gif",
		text_content: "[T_T]",
		meta: { type: 4 },
	});
	expect(container.textContent).toBe("[T_T]");
	expect(container.querySelector("img")).toBeNull();
	expect(onChange).toHaveBeenLastCalledWith("[T_T]");
});

it("图片地址缺失时仍保留自定义表情身份，不把显示名写入正文", () => {
	const { onChange } = insertEmoji({
		id: 3,
		name: "招手",
		custom_emoji_id: "00000000-0000-0000-0000-000000000001",
		url: "",
	});
	expect(onChange).toHaveBeenLastCalledWith("[招手:00000000-0000-0000-0000-000000000001]");
});
