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

    it("无 language class 的 pre/code 仍按围栏代码块渲染，不降级为行内代码", () => {
        // 编辑器将「自动/纯文本」存为 language:null，序列化后丢失 language-text class，
        // 但前台必须仍识别为围栏代码块，否则会变成行内 <code> 样式。
        const html = "<pre><code>const a = 1;\nconst b = 2;</code></pre>";
        const { container } = render(<HtmlContent html={html} />);

        // 应有围栏代码块外层容器，而非行内代码的 bg-muted 样式
        expect(container.querySelector(".bg-\\[\\#24292e\\]")).toBeTruthy();
        expect(container.querySelector("pre")).toBeTruthy();
        expect(container.querySelector(".bg-muted")).toBeNull();
    });
});

describe("HtmlContent 标题锚点 id", () => {
    it("无 id 的 heading 渲染后应补上 id（与 extractToc 生成的 slug 一致）", () => {
        // 模拟 TipTap getHTML 产出：heading 无 id
        const html = "<h2>你好世界</h2><h3>子标题</h3>";
        const { container } = render(<HtmlContent html={html} />);

        const h2 = container.querySelector("h2");
        const h3 = container.querySelector("h3");
        expect(h2?.id).toBe("你好世界");
        expect(h3?.id).toBe("子标题");
    });

    it("已有 id 的 heading 保持不变", () => {
        const html = '<h2 id="custom-id">标题</h2>';
        const { container } = render(<HtmlContent html={html} />);
        expect(container.querySelector("h2")?.id).toBe("custom-id");
    });

    it("渲染出的 heading id 与 extractToc 提取的 id 完全一致（含重复文本去重）", async () => {
        // 端到端契约：目录点击 scrollIntoView 依赖 extractToc 的 id == DOM 的 id
        const { extractToc } = await import("@/shared/lib/hooks/use-toc");
        const html = [
            "<h2>项目背景</h2>",
            "<h3>技术选型</h3>",
            "<h2>核心实现</h2>",
            "<h2>总结</h2>", // 重复文本触发去重
            "<h2>总结</h2>",
        ].join("");
        const toc = extractToc(html);
        const { container } = render(<HtmlContent html={html} />);
        const domIds = Array.from(container.querySelectorAll("h2,h3,h4")).map((h) => h.id);
        expect(domIds).toEqual(toc.map((it) => it.id));
    });
});
