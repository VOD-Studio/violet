/**
 * MarkdownContent 数学公式测试
 *
 * 核心场景：降级路径（旧 Markdown 文章）的 $..$ / $$..$$ 经 remark-math 解析、
 * markdownComponents 数学分支渲染为 KaTeX，与 HTML 主路径视觉一致。
 */
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownContent } from "../MarkdownContent";

describe("MarkdownContent 数学公式", () => {
	it("行内 $..$ 渲染 KaTeX", async () => {
		render(<MarkdownContent content={"质能方程 $E=mc^2$ 著名"} />);
		await waitFor(() => expect(document.querySelector(".katex")).toBeTruthy());
	});

	it("块级 $$..$$ 渲染 display 模式", async () => {
		render(<MarkdownContent content={"$$\n\\sum_{i=1}^{n} i\n$$"} />);
		await waitFor(() => expect(document.querySelector(".katex-display")).toBeTruthy());
	});
});
