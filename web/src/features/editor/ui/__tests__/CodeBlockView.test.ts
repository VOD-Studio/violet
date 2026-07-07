/**
 * resolveLanguageFromElement 回归测试。
 *
 * 锁定远程链接导入代码块语言识别：readability（go-readability）抽取掘金等站点
 * 输出 `<pre><code lang="go">`，此前 parseHTML 仅查 class 与 data-* 属性，导致
 * 这类代码块全部识别为纯文本。
 */
import { describe, expect, it } from "vitest";
import { resolveLanguageFromElement } from "../CodeBlockView";

/** 用 DOMParser 解析片段，返回首个 <pre> 元素 */
function preFromHtml(html: string): Element {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const pre = doc.querySelector("pre");
    if (!pre) throw new Error(`no <pre> in: ${html}`);
    return pre;
}

describe("resolveLanguageFromElement", () => {
    it('识别 readability 输出的 <code lang="go">（掘金结构）', () => {
        const pre = preFromHtml(`<pre><code lang="go">package main</code></pre>`);
        expect(resolveLanguageFromElement(pre)).toBe("go");
    });

    it('识别 <code lang="bash"> 属性', () => {
        const pre = preFromHtml(`<pre><code lang="bash">go get -u</code></pre>`);
        expect(resolveLanguageFromElement(pre)).toBe("bash");
    });

    it('识别 <code class="language-go"> 标准 markdown 结构', () => {
        const pre = preFromHtml(`<pre><code class="language-go">package main</code></pre>`);
        expect(resolveLanguageFromElement(pre)).toBe("go");
    });

    it("识别 class 在 <pre> 上（而非 <code>）", () => {
        const pre = preFromHtml(`<pre class="language-rust"><code>fn main()</code></pre>`);
        expect(resolveLanguageFromElement(pre)).toBe("rust");
    });

    it("识别 lang- 前缀", () => {
        const pre = preFromHtml(`<pre><code class="lang-python">print(1)</code></pre>`);
        expect(resolveLanguageFromElement(pre)).toBe("python");
    });

    it("识别 hljs- 前缀", () => {
        const pre = preFromHtml(`<pre><code class="hljs-go">package main</code></pre>`);
        expect(resolveLanguageFromElement(pre)).toBe("go");
    });

    it("识别 brush: 前缀", () => {
        const pre = preFromHtml(`<pre><code class="brush: js">const x</code></pre>`);
        expect(resolveLanguageFromElement(pre)).toBe("js");
    });

    it("识别 data-language 属性", () => {
        const pre = preFromHtml(`<pre><code data-language="typescript">const x</code></pre>`);
        expect(resolveLanguageFromElement(pre)).toBe("typescript");
    });

    it("识别 data-lang 属性", () => {
        const pre = preFromHtml(`<pre><code data-lang="java">class A</code></pre>`);
        expect(resolveLanguageFromElement(pre)).toBe("java");
    });

    it("语言归一化为小写", () => {
        const pre = preFromHtml(`<pre><code lang="Go">package main</code></pre>`);
        expect(resolveLanguageFromElement(pre)).toBe("go");
    });

    it("plaintext / text 归一为 null（走 highlightAuto）", () => {
        const pre = preFromHtml(`<pre><code class="language-text">hello</code></pre>`);
        expect(resolveLanguageFromElement(pre)).toBeNull();
    });

    it("无任何语言标识时返回 null", () => {
        const pre = preFromHtml(`<pre><code>plain code without language</code></pre>`);
        expect(resolveLanguageFromElement(pre)).toBeNull();
    });
});
