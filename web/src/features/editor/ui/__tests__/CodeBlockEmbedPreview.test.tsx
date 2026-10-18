import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RichTextEditor } from "../../RichTextEditor";

const fence = (language: string, source: string) => `\`\`\`${language}\n${source}\n\`\`\``;

const renderEditor = (value: string) =>
	render(<RichTextEditor value={value} onChange={() => {}} contentType="markdown" />);

describe("代码块里的嵌入预览", () => {
	it("围栏语言是已登记的嵌入时，代码下方预览它的渲染结果", async () => {
		renderEditor(fence("github", '{"repo": "VOD-Studio/violet"}'));

		const preview = await screen.findByRole("region", { name: "嵌入预览" });
		await within(preview).findByRole("article", { name: "GitHub 项目：VOD-Studio/violet" });
		expect(preview.getAttribute("contenteditable")).toBe("false");
	});

	it("改了围栏块里的配置，停止输入后预览跟着更新", async () => {
		const { rerender } = renderEditor(fence("github", '{"repo": "VOD-Studio/violet"}'));
		await screen.findByRole("article", { name: "GitHub 项目：VOD-Studio/violet" });

		rerender(
			<RichTextEditor
				value={fence("github", '{"repo": "VOD-Studio/kite"}')}
				onChange={() => {}}
				contentType="markdown"
			/>,
		);
		await screen.findByRole("article", { name: "GitHub 项目：VOD-Studio/kite" });
	});

	it("配置无效时预览显示降级提示，不影响编辑", async () => {
		renderEditor(fence("github", '{"repo": 1}'));

		const preview = await screen.findByRole("region", { name: "嵌入预览" });
		await within(preview).findByText("无法解析 github 卡片配置");
	});

	it("普通代码块没有预览", async () => {
		renderEditor(fence("ts", "const answer = 42;"));

		// 语言下拉出现说明代码块的节点视图已挂载
		await screen.findByRole("combobox");
		expect(screen.queryByRole("region", { name: "嵌入预览" })).toBeNull();
	});
});
