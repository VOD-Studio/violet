/**
 * 公式渲染端到端字形验证
 *
 * 契约：干净的 LaTeX 源码（单反斜杠）经 HtmlContent 渲染后，
 * 可见区域（.katex-html，MathML 无障碍注解除外）必须出现真正的
 * 数学符号（π、φ、≈），而非命令名文本（pi、varphi、frac）。
 */
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HtmlContent } from "../HtmlContent";

/** 取 KaTeX 可见渲染区的文本（剔除 MathML annotation 中的 LaTeX 源码） */
function visibleMathText(container: HTMLElement): string {
	return container.querySelector(".katex-html")?.textContent ?? "";
}

describe("公式渲染出真符号", () => {
	it("inline-math: \\pi 渲染为 π 字形", async () => {
		const { container } = render(
			<HtmlContent
				html={
					'<p>欧拉 <span data-type="inline-math" data-latex="e^{i\\pi}+1=0"></span></p>'
				}
			/>,
		);
		await waitFor(() => expect(container.querySelector(".katex")).toBeTruthy());
		const text = visibleMathText(container);
		expect(text).toContain("π");
		expect(text).not.toContain("ipi");
	});

	it("block-math: \\varphi \\frac \\approx 渲染为 φ 分数 ≈", async () => {
		const { container } = render(
			<HtmlContent
				html={
					'<div data-type="block-math" data-latex="\\varphi = \\frac{1+\\sqrt{5}}{2} \\approx 1.618"></div>'
				}
			/>,
		);
		await waitFor(() => expect(container.querySelector(".katex-display")).toBeTruthy());
		const text = visibleMathText(container);
		expect(text).toContain("φ");
		expect(text).toContain("≈");
		expect(text).not.toContain("varphi");
		expect(text).not.toContain("frac");
	});
});
