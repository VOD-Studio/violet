import { EditorView } from "@codemirror/view";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef, useState } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { RichTextEditor } from "../RichTextEditor";
import type { RichTextEditorHandle } from "../types";

// jsdom 不实现 Range 布局测量；内容状态与 CodeMirror 事务仍使用真实实现。
const rangeMeasurements = {
	getClientRects: Object.getOwnPropertyDescriptor(Range.prototype, "getClientRects"),
	getBoundingClientRect: Object.getOwnPropertyDescriptor(
		Range.prototype,
		"getBoundingClientRect",
	),
};
beforeAll(() => {
	Object.defineProperties(Range.prototype, {
		getClientRects: { configurable: true, value: () => [] },
		getBoundingClientRect: { configurable: true, value: () => new DOMRect() },
	});
});
afterAll(() => {
	for (const [name, descriptor] of Object.entries(rangeMeasurements)) {
		if (descriptor) Object.defineProperty(Range.prototype, name, descriptor);
		else Reflect.deleteProperty(Range.prototype, name);
	}
});

function replaceSource(container: HTMLElement, text: string) {
	const element = container.querySelector<HTMLElement>(".cm-content");
	if (!element) throw new Error("源码编辑器未挂载");
	const view = EditorView.findFromDOM(element);
	if (!view) throw new Error("CodeMirror 实例未挂载");
	act(() => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } }));
}

describe("源码模式保存", () => {
	it.each([
		"html",
		"markdown",
	] as const)("%s 受控表单在源码模式直接取得当前内容", async (contentType) => {
		const ref = createRef<RichTextEditorHandle>();
		let formValue = "";
		function Form() {
			const [value, setValue] = useState(contentType === "html" ? "<p>旧内容</p>" : "旧内容");
			formValue = value;
			return (
				<RichTextEditor
					ref={ref}
					value={value}
					onChange={setValue}
					contentType={contentType}
				/>
			);
		}
		const { container } = render(<Form />);
		await waitFor(() => expect(ref.current?.getHTML()).toContain("旧内容"));
		fireEvent.click(screen.getByTitle("切换 Markdown 源码 / 富文本"));
		const source = "## 新标题\n\n尚未退出源码的 **修改**。\n";
		replaceSource(container, source);
		expect(ref.current?.getMarkdown()).toBe(source);
		expect(ref.current?.getHTML()).toContain("<strong>修改</strong>");
		expect(ref.current?.getHTML()).not.toContain("旧内容");
		expect(formValue).toBe(contentType === "html" ? ref.current?.getHTML() : source);
		fireEvent.click(screen.getByTitle("切换 Markdown 源码 / 富文本"));
		expect(container.querySelector(".tiptap")?.textContent).toContain("尚未退出源码的 修改");
	});

	it("源码打开时外部替换只更新可见内容，不冒充用户输入", async () => {
		const ref = createRef<RichTextEditorHandle>();
		const onChange = vi.fn();
		const { container, rerender } = render(
			<RichTextEditor ref={ref} value="初始" onChange={onChange} contentType="markdown" />,
		);
		await waitFor(() => expect(ref.current?.getHTML()).toContain("初始"));
		fireEvent.click(screen.getByTitle("切换 Markdown 源码 / 富文本"));
		rerender(
			<RichTextEditor
				ref={ref}
				value="## 服务器版本"
				onChange={onChange}
				contentType="markdown"
			/>,
		);
		await waitFor(() =>
			expect(container.querySelector(".cm-content")?.textContent).toContain("服务器版本"),
		);
		expect(ref.current?.getMarkdown()).toBe("## 服务器版本");
		expect(onChange).not.toHaveBeenCalled();
	});

	it("源码仍打开时导出的是未经规范化的当前源码", async () => {
		const ref = createRef<RichTextEditorHandle>();
		const { container } = render(
			<RichTextEditor ref={ref} value="初始" onChange={() => {}} contentType="markdown" />,
		);
		await waitFor(() => expect(ref.current?.getHTML()).toContain("初始"));
		fireEvent.click(screen.getByTitle("切换 Markdown 源码 / 富文本"));
		const source = "引用[站点][site]\n\n[site]: https://example.com\n";
		replaceSource(container, source);
		const createURL = vi.fn((_blob: Blob | MediaSource) => "blob:export");
		const originalCreate = URL.createObjectURL;
		const originalRevoke = URL.revokeObjectURL;
		URL.createObjectURL = createURL;
		URL.revokeObjectURL = vi.fn();
		const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
		try {
			fireEvent.click(screen.getByTitle("导出为 .md"));
			const blob = createURL.mock.calls[0]?.[0] as Blob;
			const text = await new Promise<string>((resolve) => {
				const reader = new FileReader();
				reader.onload = () => resolve(String(reader.result));
				reader.readAsText(blob);
			});
			expect(text).toBe(source);
		} finally {
			URL.createObjectURL = originalCreate;
			URL.revokeObjectURL = originalRevoke;
			click.mockRestore();
		}
	});
});
