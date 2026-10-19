import { type ArticleEmbedPickerProps, registerArticleEmbed } from "@shared/ui/article-embeds";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { Smile } from "lucide-react";
import { createRef, useEffect, useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { RichTextEditor } from "../../RichTextEditor";
import { buildEmbedSlashItems } from "../../slash-menu/slash-items";
import type { RichTextEditorHandle } from "../../types";

/** 测试用的选择表单：一个名字输入框，填了就报告 {"name": …}。 */
function GreetingPicker({ initialSource, onChange }: ArticleEmbedPickerProps) {
	const [name, setName] = useState<string>(
		initialSource ? (JSON.parse(initialSource) as { name: string }).name : "",
	);
	useEffect(() => onChange(name ? JSON.stringify({ name }) : null), [name, onChange]);
	return (
		<label>
			名字
			<input value={name} onChange={(event) => setName(event.target.value)} />
		</label>
	);
}

const greeting = {
	kind: "greeting",
	languages: ["greeting", "hello"],
	load: async () => ({
		parse: (input: unknown) =>
			typeof (input as { name?: unknown })?.name === "string"
				? { name: (input as { name: string }).name }
				: null,
		Component: ({ config }: { config: { name: string } }) => <p>你好，{config.name}</p>,
	}),
	inserter: {
		title: "问候",
		description: "插入一句问候",
		keywords: ["wave"],
		icon: Smile,
		loadPicker: async () => GreetingPicker,
	},
};
registerArticleEmbed(greeting);

beforeAll(() => {
	// jsdom 未实现 scrollIntoView，SlashMenuView 选中变化时会调用
	Element.prototype.scrollIntoView = vi.fn();
	// 也不实现 Range 布局测量；弹层关闭后焦点还给编辑器时，ProseMirror 会量选区把它滚进视野
	Object.defineProperties(Range.prototype, {
		getClientRects: { configurable: true, value: () => [] },
		getBoundingClientRect: { configurable: true, value: () => new DOMRect() },
	});
});

function renderEditor(value = "") {
	const ref = createRef<RichTextEditorHandle>();
	render(<RichTextEditor ref={ref} value={value} onChange={() => {}} contentType="markdown" />);
	return ref;
}

/** Tiptap 把实例挂在可编辑根节点上。 */
const editorOf = () =>
	(document.querySelector(".ProseMirror") as HTMLElement & { editor: Editor }).editor;

const type = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } });

describe("Slash 菜单里的文章嵌入", () => {
	it("只列出声明了插入入口的嵌入，别名与围栏语言都能搜到", () => {
		const pick = vi.fn();
		const items = buildEmbedSlashItems(pick);

		expect(items.map((item) => item.id)).toEqual(["embed-greeting"]);
		expect(items[0]).toMatchObject({ title: "问候", group: "嵌入" });
		expect(items[0].keywords).toEqual(["wave", "greeting", "hello"]);
		items[0].command({} as Editor);
		expect(pick).toHaveBeenCalledWith(greeting);
	});

	it("选中后在弹层里填写并预览，插入的是对应的围栏块", async () => {
		const ref = renderEditor();
		await waitFor(() => expect(editorOf()).toBeTruthy());

		act(() => {
			editorOf().commands.insertContent("/问候");
		});
		fireEvent.click(await screen.findByRole("button", { name: /问候/ }));
		const dialog = await screen.findByRole("dialog", { name: "插入问候" });
		const insert = within(dialog).getByRole("button", { name: "插入" }) as HTMLButtonElement;
		expect(insert.disabled).toBe(true);
		within(dialog).getByText("选好之后在这里预览");

		type(await within(dialog).findByLabelText("名字"), "Kite");
		await within(dialog).findByText("你好，Kite");
		fireEvent.click(insert);

		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(ref.current?.getMarkdown()).toContain('```greeting\n{"name":"Kite"}\n```');
		expect(ref.current?.getMarkdown()).not.toContain("/问候");
	});

	it("代码块上的编辑按钮回填原文，更新后替换整块；取消不改动", async () => {
		const ref = renderEditor('```greeting\n{"name":"Kite"}\n```');

		fireEvent.click(await screen.findByRole("button", { name: "编辑问候" }));
		let dialog = await screen.findByRole("dialog", { name: "编辑问候" });
		const input = (await within(dialog).findByLabelText("名字")) as HTMLInputElement;
		expect(input.value).toBe("Kite");
		type(input, "Mira");
		fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(ref.current?.getMarkdown()).toContain('{"name":"Kite"}');

		fireEvent.click(screen.getByRole("button", { name: "编辑问候" }));
		dialog = await screen.findByRole("dialog", { name: "编辑问候" });
		type(await within(dialog).findByLabelText("名字"), "Violet");
		fireEvent.click(within(dialog).getByRole("button", { name: "更新" }));

		await waitFor(() => expect(ref.current?.getMarkdown()).toContain('{"name":"Violet"}'));
		expect(ref.current?.getMarkdown()).not.toContain("Kite");
	});
});
