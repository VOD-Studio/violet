/**
 * katex-core 测试
 *
 * 核心场景：共享渲染核心对数学/化学(mhchem)/物理宏三类内容都产出 KaTeX HTML；
 * 非法公式 throwOnError:false 不抛异常，输出 katex-error 标记。
 */
import { describe, expect, it } from "vitest";
import { KATEX_MACROS, renderKatex } from "../katex-core";

describe("renderKatex", () => {
	it("行内公式渲染为 katex HTML", () => {
		expect(renderKatex("E=mc^2", false)).toContain("katex");
	});

	it("块级公式带 katex-display 包裹", () => {
		expect(renderKatex("\\sum_{i=1}^{n} i", true)).toContain("katex-display");
	});

	it("物理宏表展开 \\dv \\ket \\abs", () => {
		const html = renderKatex("\\dv{f}{x} + \\ket{\\psi} + \\abs{x}", false);
		expect(html).toContain("katex");
		expect(html).not.toContain("katex-error");
	});

	it("mhchem 化学式 \\ce 与物理单位 \\pu 可用", () => {
		const html = renderKatex("\\ce{H2O} + \\pu{9.8 m/s^2}", false);
		expect(html).toContain("katex");
		expect(html).not.toContain("katex-error");
	});

	it("\\div 未被宏表覆写（仍是除号）", () => {
		expect(KATEX_MACROS["\\div"]).toBeUndefined();
		const html = renderKatex("6 \\div 3 = 2", false);
		expect(html).not.toContain("katex-error");
	});

	it("非法公式不抛错，输出 katex-error", () => {
		expect(() => renderKatex("\\frac{1", false)).not.toThrow();
		expect(renderKatex("\\frac{1", false)).toContain("katex-error");
	});
});
