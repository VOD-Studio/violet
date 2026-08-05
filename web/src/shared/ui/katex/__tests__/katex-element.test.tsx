/**
 * katex-element 白名单渲染管线测试
 *
 * 契约：KaTeX HTML 经 hast 解析 → sanitize 白名单 → React 元素，
 * 全程不经 dangerouslySetInnerHTML（ADR-0005）。
 * 白名单不得误伤 KaTeX 正常输出（span 排版 / MathML 注解 / svg 根号），
 * 也不得放行脚本与事件处理器。
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderKatexElement } from "../katex-element";

/** 渲染 LaTeX 并返回 testing-library 结果（displayMode 决定行内/块级包裹标签） */
function renderLatex(latex: string, displayMode = false) {
	const node = renderKatexElement(latex, displayMode);
	return displayMode ? render(<div>{node}</div>) : render(<span>{node}</span>);
}

/** 管线允许出现的全部标签 */
const ALLOWED_TAGS = new Set([
	"span",
	"math",
	"semantics",
	"annotation",
	"mrow",
	"mi",
	"mo",
	"mn",
	"mtext",
	"mspace",
	"msup",
	"msub",
	"msubsup",
	"mfrac",
	"msqrt",
	"mroot",
	"mtable",
	"mtr",
	"mtd",
	"munder",
	"mover",
	"munderover",
	"mpadded",
	"mphantom",
	"menclose",
	"mstyle",
	"mmultiscripts",
	"mprescripts",
	"none",
	"mlabeledtr",
	"maligngroup",
	"malignmark",
	"merror",
	"maction",
	"mstack",
	"mlongdiv",
	"mscarries",
	"mscarry",
	"msline",
	"msrow",
	"ms",
	"svg",
	"path",
]);

describe("renderKatexElement", () => {
	it("行内公式渲染出 .katex 结构", () => {
		const { container } = renderLatex("E=mc^2");
		expect(container.querySelector(".katex")).toBeTruthy();
		expect(container.querySelector(".katex-html")).toBeTruthy();
	});

	it("块级公式渲染出 .katex-display", () => {
		const { container } = renderLatex("\\sum_{i=1}^{n} i", true);
		expect(container.querySelector(".katex-display")).toBeTruthy();
	});

	it("MathML 无障碍注解保留（math / semantics / annotation 含源码）", () => {
		const { container } = renderLatex("x+1");
		expect(container.querySelector("math")).toBeTruthy();
		expect(container.querySelector("semantics")).toBeTruthy();
		expect(container.querySelector("annotation")?.textContent).toContain("x+1");
	});

	it("\\sqrt 的 svg 根号不被白名单误伤", () => {
		const { container } = renderLatex("\\sqrt{5}");
		expect(container.querySelector("svg")).toBeTruthy();
		expect(container.querySelector("svg path")).toBeTruthy();
	});

	it("物理宏与 mhchem 正常渲染，无 katex-error", () => {
		const { container } = renderLatex("\\dv{f}{x} + \\ce{H2O}");
		expect(container.querySelector(".katex")).toBeTruthy();
		expect(container.querySelector(".katex-error")).toBeNull();
	});

	it("非法公式内嵌 .katex-error，不抛错", () => {
		const { container } = renderLatex("\\frac{1");
		expect(container.querySelector(".katex-error")).toBeTruthy();
	});

	it("输出标签全部在白名单内，且无 on* 事件属性", () => {
		const { container } = renderLatex(
			"\\widehat{ABC} + \\frac{1}{\\sqrt{x}} + \\ce{2H2 + O2 -> 2H2O}",
			true,
		);
		// container.firstElementChild 是 renderLatex 的包裹元素，检查其内部（公式本体）
		const wrapper = container.firstElementChild;
		if (!wrapper) throw new Error("无渲染输出");
		const elements = Array.from(wrapper.querySelectorAll("*"));
		expect(elements.length).toBeGreaterThan(0);
		for (const el of elements) {
			expect(ALLOWED_TAGS.has(el.tagName.toLowerCase())).toBe(true);
			for (const attr of Array.from(el.attributes)) {
				expect(attr.name.toLowerCase().startsWith("on")).toBe(false);
			}
		}
	});

	it("脚本载体（script/iframe/object 等）无法进入输出", () => {
		const { container } = renderLatex("x");
		expect(container.querySelector("script,iframe,object,embed,link,meta")).toBeNull();
	});
});
