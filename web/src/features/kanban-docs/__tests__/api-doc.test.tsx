import { MarkdownContent } from "@shared/ui/markdown-preview/MarkdownContent";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { apiDocOutline, KANBAN_API_DOC, toSiteApiDoc } from "../lib/api-doc";

describe("看板 API 正文", () => {
	it("去掉一级标题，包内相对链接改指仓库里的同一文件", () => {
		const doc = toSiteApiDoc(
			"# 标题\n\n[中文入门](../README.zh-CN.md) · [示例](./guide.md) · [外链](https://example.com)\n",
		);
		expect(doc).not.toContain("# 标题");
		expect(doc).toContain(
			"[中文入门](https://github.com/VOD-Studio/violet/blob/release/2.0/web/packages/kanban/README.zh-CN.md)",
		);
		expect(doc).toContain(
			"[示例](https://github.com/VOD-Studio/violet/blob/release/2.0/web/packages/kanban/docs/guide.md)",
		);
		expect(doc).toContain("[外链](https://example.com)");
	});

	it("目录只列二级标题；重名标题与渲染管线一样追加序号", () => {
		expect(apiDocOutline("## 甲\n### 乙\n## 乙\n## `Board`\n")).toEqual([
			{ id: "甲", title: "甲" },
			{ id: "乙-1", title: "乙" },
			{ id: "board", title: "Board" },
		]);
	});

	it("目录里的每个 id 都能在渲染出的正文里找到", () => {
		const { container } = render(<MarkdownContent content={KANBAN_API_DOC} />);
		const outline = apiDocOutline(KANBAN_API_DOC);

		expect(outline.length).toBeGreaterThan(10);
		for (const section of outline)
			expect(container.querySelector(`[id="${section.id}"]`)?.textContent).toContain(
				section.title,
			);
	});
});
