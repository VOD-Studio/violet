import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RichTextEditor } from "../RichTextEditor";

const settleEditor = () =>
	act(async () => {
		await vi.advanceTimersByTimeAsync(30);
	});

describe("RichTextEditor controlled value", () => {
	it("prop 驱动的 Markdown 载入与替换不会反向报告为用户修改", async () => {
		vi.useFakeTimers();
		try {
			const onChange = vi.fn();
			const { rerender } = render(
				<RichTextEditor
					value={"> 引用第一行  \n> 引用第二行\n\n## 人物锚点\n\n初始内容。"}
					onChange={onChange}
					contentType="markdown"
				/>,
			);
			await settleEditor();
			expect(onChange).not.toHaveBeenCalled();

			rerender(
				<RichTextEditor
					value="## 服务器新版本\n\n重新载入后的正文。"
					onChange={onChange}
					contentType="markdown"
				/>,
			);
			await settleEditor();
			expect(onChange).not.toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}
	});
});
