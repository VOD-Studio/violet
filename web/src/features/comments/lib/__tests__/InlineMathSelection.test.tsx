import { InlineMathContent } from "@shared/ui/katex/InlineMathContent";
import * as mathLoader from "@shared/ui/katex/math-formula-loader";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getBlockText } from "../extract-blocks";
import { selectionToAnchor } from "../selection-to-anchor";

afterEach(() => {
	window.getSelection()?.removeAllRanges();
	vi.restoreAllMocks();
});

describe("行内公式的阅读批注", () => {
	it("从真实排版公式内部选字时吸附到完整 LaTeX，而不是丢掉公式", async () => {
		const { container } = render(
			<p>
				前文
				<InlineMathContent latex="E=mc^2" />
				后文
			</p>,
		);
		await act(() => vi.dynamicImportSettled());
		await waitFor(() => expect(container.querySelector(".katex-html")).toBeTruthy());
		const formula = container.querySelector(".katex-html");
		if (!formula) throw new Error("公式排版未完成");
		const text = document.createTreeWalker(formula, NodeFilter.SHOW_TEXT).nextNode();
		if (!text) throw new Error("公式没有可选择的字形");
		const range = document.createRange();
		range.setStart(text, 0);
		range.setEnd(text, 1);
		window.getSelection()?.addRange(range);
		const anchor = await selectionToAnchor({ root: container });
		expect(anchor).toMatchObject({ startOffset: 2, endOffset: 8 });
	});

	it("模块失败与恢复不改变段落规范文本，不把错误提示写入批注", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.spyOn(mathLoader, "loadInlineMathFormula").mockRejectedValueOnce(
			new Error("模块下载失败"),
		);
		const { container } = render(
			<p>
				前文
				<InlineMathContent latex="E=mc^2" />
				后文
			</p>,
		);
		const paragraph = container.querySelector("p");
		if (!paragraph) throw new Error("正文段落缺失");
		await screen.findByRole("alert");
		expect(getBlockText(paragraph)).toBe("前文E=mc^2后文");
		fireEvent.click(screen.getByRole("button", { name: "重试" }));
		await act(() => vi.dynamicImportSettled());
		await waitFor(() => expect(container.querySelector(".katex-html")).toBeTruthy());
		expect(getBlockText(paragraph)).toBe("前文E=mc^2后文");
		expect(screen.queryByRole("alert")).toBeNull();
	});
});
