/**
 * HtmlContent 回归测试
 *
 * 核心场景：content_html 中含空行的代码块必须保持为单个 <pre>，不被拆成多段。
 * 历史上用 react-markdown 渲染 HTML 时，remark-parse 会按 CommonMark 的 HTML 块规则
 * 在代码块内空行处截断，导致一个代码块被拆成多个片段并混入段落。
 */
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HtmlContent } from "../HtmlContent";

// 屏蔽异步 shiki：CodeBlock 走降级 pre/code，便于同步断言代码块结构
vi.mock("@/shared/ui/code-preview/use-shiki-highlight", () => ({
	useShikiHighlight: () => ({ html: "", loading: false }),
}));

// 真实 mermaid 在 jsdom 跑不了（依赖 layout/worker）；mock renderMermaid 同步返回
// 固定 SVG，断言白名单保留 → 注册表分发 → SVG 写入容器的完整链路。
// 参考 diagram/__tests__/render-mermaid.test.ts 同款 mock 思路。
vi.mock("@/shared/ui/diagram/render-mermaid", () => ({
	renderMermaid: async () => ({
		svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>mock-svg</text></svg>',
	}),
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

	it("正文图片走 w=1200 缩略(webp),原图只在预览时加载", () => {
		const html = '<p><img src="/uploads/2026/07/a.jpg" alt="示例"></p>';
		const { container } = render(<HtmlContent html={html} />);

		const img = container.querySelector("img");
		expect(img?.getAttribute("src")).toBe("/uploads/2026/07/a.jpg?w=1200&format=webp");
	});

	it("正文 GIF 图片剥除处理参数(保动画),crop 参数保留", () => {
		const html = '<p><img src="/uploads/2026/07/a.gif?crop=0.1,0.2,0.5,0.5" alt="动图"></p>';
		const { container } = render(<HtmlContent html={html} />);

		const img = container.querySelector("img");
		const src = img?.getAttribute("src") ?? "";
		expect(src).not.toContain("w=1200");
		expect(src).not.toContain("format=webp");
		expect(decodeURIComponent(src)).toContain("crop=0.1,0.2,0.5,0.5");
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
		const { extractToc } = await import("@/shared/hooks/use-toc");
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

describe("HtmlContent 数学公式（浏览时渲染）", () => {
	it("inline-math span 经 sanitize 保留并渲染 KaTeX", async () => {
		render(
			<HtmlContent html='<p>质能方程 <span data-type="inline-math" data-latex="E=mc^2"></span></p>' />,
		);
		await waitFor(() => expect(document.querySelector(".katex")).toBeTruthy());
	});

	it("block-math div 渲染为 display 模式", async () => {
		render(
			<HtmlContent html='<div data-type="block-math" data-latex="\sum_{i=1}^{n} i"></div>' />,
		);
		await waitFor(() => expect(document.querySelector(".katex-display")).toBeTruthy());
	});
});

describe("HtmlContent 图块（流程图，浏览时渲染）", () => {
	it("mermaid diagram-block：白名单保留属性 → 注册表分发 → SVG 写入容器", async () => {
		// data-source 含 HTML 转义后的源码（&#10;=\n、&amp;=&）→ DOM 解析自动还原
		const html =
			'<div data-type="diagram-block" data-format="mermaid" data-source="graph TD;&#10;A&amp;B"></div>';
		const { container } = render(<HtmlContent html={html} />);

		// 等待 mock 的 renderMermaid 解析后 SVG 写入容器（role=img 载体）
		await waitFor(() => expect(container.querySelector('div[role="img"] svg')).toBeTruthy());
		expect(container.querySelector('div[role="img"] svg')?.textContent).toContain("mock-svg");
	});

	it("未注册 format（非 mermaid）→ 降级为源码 <pre>，不调渲染器", () => {
		const html =
			'<div data-type="diagram-block" data-format="plantuml" data-source="@startuml\nBob-->Alice\n@enduml"></div>';
		const { container } = render(<HtmlContent html={html} />);

		// 未注册格式命中 DiagramSourceFallback：显示源码文本，不渲染 SVG 容器
		expect(container.querySelector('div[role="img"]')).toBeNull();
		expect(container.querySelector("pre")?.textContent).toContain("@startuml");
	});

	it("无 data-format（缺格式）→ 降级为源码 <pre>", () => {
		const html = '<div data-type="diagram-block" data-source="graph TD; A-->B"></div>';
		const { container } = render(<HtmlContent html={html} />);

		expect(container.querySelector('div[role="img"]')).toBeNull();
		expect(container.querySelector("pre")?.textContent).toContain("graph TD");
	});
});
