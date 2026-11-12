import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { RichTextEditor } from "../../RichTextEditor";
import type { RichTextEditorHandle } from "../../types";

describe("代码块作者元数据", () => {
	it("通过设置编辑和清空文件名、行范围，不改变 Tiptap 源码", async () => {
		const ref = createRef<RichTextEditorHandle>();
		render(
			<RichTextEditor
				ref={ref}
				value={'```python\nprint("exact")\n```'}
				contentType="markdown"
				onChange={() => {}}
			/>,
		);
		fireEvent.click(await screen.findByRole("button", { name: "代码设置" }));
		const filename = await screen.findByRole("textbox", { name: "文件名" });
		const lines = screen.getByRole("textbox", { name: "高亮行" });
		fireEvent.change(filename, { target: { value: 'src/"example".py' } });
		fireEvent.change(lines, { target: { value: "1, 3-5" } });
		await waitFor(() => {
			const doc = new DOMParser().parseFromString(ref.current?.getHTML() ?? "", "text/html");
			const pre = doc.querySelector("pre");
			expect(pre?.getAttribute("data-filename")).toBe('src/"example".py');
			expect(pre?.getAttribute("data-lines")).toBe("1,3-5");
			expect(pre?.textContent).toBe('print("exact")');
		});
		expect(ref.current?.getMarkdown()).toContain(
			`title=${JSON.stringify('src/"example".py')} {1,3-5}`,
		);
		fireEvent.change(filename, { target: { value: "" } });
		fireEvent.change(lines, { target: { value: "" } });
		await waitFor(() => {
			expect(ref.current?.getHTML()).not.toContain("data-filename");
			expect(ref.current?.getHTML()).not.toContain("data-lines");
		});
		expect(ref.current?.getMarkdown()).toContain('print("exact")');
	});
});
