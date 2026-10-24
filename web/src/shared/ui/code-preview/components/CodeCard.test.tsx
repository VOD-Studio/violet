import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CodeCard } from "./CodeCard";

const { highlight } = vi.hoisted(() => ({ highlight: vi.fn<() => Promise<string>>() }));
vi.mock("../lib/highlighter", () => ({
	highlightCode: highlight,
	highlightCodeAuto: highlight,
	highlightCodeLight: highlight,
}));

/** 服务端输出也是加载高亮期间的阅读契约，不允许用加载动画替换代码。 */
describe("CodeCard 原文降级", () => {
	it("未执行高亮时直接输出完整可选择的源码，并转义 HTML 字符", () => {
		const source = '<script>alert("text")</script>\nconst value = 42;';
		const markup = renderToString(
			<CodeCard code={source} language="javascript" collapseLines={0} />,
		);
		const container = document.createElement("div");
		container.innerHTML = markup;
		expect(container.querySelector("pre code")?.textContent).toBe(source);
		expect(container.querySelector("script")).toBeNull();
		expect(container.querySelector(".animate-spin")).toBeNull();
	});

	it("同实例更新源码时立即显示新原文，不把旧高亮作为新输入的等待态", async () => {
		let resolvePending: ((html: string) => void) | undefined;
		const pending = new Promise<string>((resolve) => {
			resolvePending = resolve;
		});
		highlight.mockResolvedValueOnce('<pre class="shiki"><code>const value = 1;</code></pre>');
		highlight.mockReturnValueOnce(pending);
		const { rerender } = render(<CodeCard code="const value = 1;" language="javascript" />);
		await screen.findByText("const value = 1;", { selector: ".shiki code" });
		rerender(<CodeCard code="const value = 2;" language="javascript" />);
		expect(screen.queryByText("const value = 1;")).toBeNull();
		expect(screen.getByText("const value = 2;", { selector: "pre > code" })).toBeTruthy();
		await act(async () => {
			resolvePending?.('<pre class="shiki"><code>const value = 2;</code></pre>');
		});
		expect(screen.getByText("const value = 2;", { selector: ".shiki code" })).toBeTruthy();
	});
});
