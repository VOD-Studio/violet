/**
 * HtmlContent 回归测试
 *
 * 核心场景：content_html 中含空行的代码块必须保持为单个 <pre>，不被拆成多段。
 * 历史上用 react-markdown 渲染 HTML 时，remark-parse 会按 CommonMark 的 HTML 块规则
 * 在代码块内空行处截断，导致一个代码块被拆成多个片段并混入段落。
 */
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HtmlContent } from "../HtmlContent";

// 屏蔽异步 shiki：CodeBlock 走降级 pre/code，便于同步断言代码块结构
vi.mock("@/shared/ui/code-preview/use-shiki-highlight", () => ({
    useShikiHighlight: () => ({ html: "", loading: false }),
}));

describe("HtmlContent", () => {
    it("代码块内含空行时不被拆分：单个 pre、文本完整、无段落混入", () => {
        // 模拟 TipTap getHTML 产出：pre > code.language-x，代码内含空行（函数间）
        const html = [
            "<p>intro</p>",
            '<pre><code class="language-rust">fn a() {',
            "    a",
            "}",
            "",
            "fn b() {",
            "    b",
            "}</code></pre>",
            "<p>outro</p>",
        ].join("\n");

        const { container } = render(<HtmlContent html={html} />);

        // 回归断言：一个 pre，未被空行拆成多段
        expect(container.querySelectorAll("pre")).toHaveLength(1);

        const pre = container.querySelector("pre");
        expect(pre?.textContent).toContain("fn a()");
        expect(pre?.textContent).toContain("fn b()");

        // 仅 intro/outro 两个段落，代码块内不应混入拆分产生的段落
        expect(container.querySelectorAll("p")).toHaveLength(2);
    });

    it("HTML 中的特殊字符正常转义还原（< > &）", () => {
        // 代码里含泛型 <T>、比较 >、&& —— TipTap 以实体存储，渲染后应还原为字面字符
        const html =
            '<pre><code class="language-rust">if a &lt; b &amp;&amp; c &gt; d {}</code></pre>';
        const { container } = render(<HtmlContent html={html} />);

        expect(container.querySelector("pre")?.textContent).toContain("if a < b && c > d {}");
    });
});
