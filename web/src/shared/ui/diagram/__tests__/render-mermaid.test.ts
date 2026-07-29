/**
 * renderMermaid 测试
 *
 * 安全命门：mock mermaid.render 返回固定 SVG（含攻击 payload），真实跑 DOMPurify
 * 清理，断言 on* 事件属性、script、foreignObject 可执行内容被剥除。这是针对 docmost
 * CVE-2026-23630（per-diagram %%{init:loose}%% 绕过全局 strict）的第二道防线验证。
 *
 * jsdom 跑不了真实 mermaid.render（依赖真实 DOM layout / web worker），故 mock；
 * DOMPurify 在 jsdom 下工作正常，清理是真实测的。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RenderMermaidResult } from "../render-mermaid";

const mermaidRender = vi.fn();
const mermaidInitialize = vi.fn();
vi.mock("mermaid", () => ({
    default: {
        initialize: mermaidInitialize,
        render: mermaidRender,
    },
}));

import { renderMermaid } from "../render-mermaid";

const CLEAN_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg"><g><rect width="10" height="10" fill="#000"/></g></svg>';

/** 用 in 判别式做受检窄化，取 svg；若实际是 error 分支则抛出错误信息（测试失败可见） */
function unwrapSvg(result: RenderMermaidResult): string {
    if ("svg" in result) return result.svg;
    throw new Error(`expected { svg } but got error: ${result.error}`);
}

describe("renderMermaid", () => {
    beforeEach(() => {
        mermaidRender.mockReset();
        mermaidInitialize.mockReset();
    });

    it("合法源 → 返回 { svg }，且 initialize 用 strict 安全级别 + base 主题", async () => {
        mermaidRender.mockResolvedValue({ svg: CLEAN_SVG });

        const result = await renderMermaid("graph TD; A-->B", "light");

        expect("svg" in result).toBe(true);
        expect("error" in result).toBe(false);
        expect(unwrapSvg(result)).toContain("<svg");
        expect(mermaidInitialize).toHaveBeenCalledWith(
            expect.objectContaining({
                startOnLoad: false,
                securityLevel: "strict",
                theme: "base",
            }),
        );
        expect(mermaidInitialize).toHaveBeenCalledWith(
            expect.objectContaining({ themeVariables: expect.any(Object) }),
        );
    });

    it("initialize 含 suppressErrorRendering: true（防 mermaid 画错误图残留在 body）", async () => {
        // mermaid v11 默认 suppressErrorRendering:false，解析失败时不抛错，而是把含
        // "Syntax error in text" 的错误图画进 document.body 的临时 div，throw 前不清理 →
        // 残留显示在界面底部。我们必须显式 true 让它在画错误图前就抛错。
        mermaidRender.mockResolvedValue({ svg: CLEAN_SVG });

        await renderMermaid("graph TD; A-->B", "light");

        expect(mermaidInitialize).toHaveBeenCalledWith(
            expect.objectContaining({ suppressErrorRendering: true }),
        );
    });

    it("默认主题为 light（不传 theme）", async () => {
        mermaidRender.mockResolvedValue({ svg: CLEAN_SVG });
        await renderMermaid("graph TD; A-->B");
        expect(mermaidInitialize).toHaveBeenCalled();
    });

    it("mermaid.render 抛错（语法错误）→ 返回 { error }，不 throw", async () => {
        mermaidRender.mockRejectedValue(new Error("Parse error: No diagram type detected"));

        const result = await renderMermaid("!!! 这不是合法 mermaid !!!", "light");

        expect("error" in result).toBe(true);
        expect("svg" in result).toBe(false);
        if ("error" in result) {
            expect(result.error).toMatch(/parse error|no diagram/i);
        }
    });

    it("非 Error 抛出对象 → 仍返回 { error: string }，不 throw", async () => {
        mermaidRender.mockRejectedValue("plain string failure");
        const result = await renderMermaid("graph TD; A-->B", "light");
        expect("error" in result).toBe(true);
        if ("error" in result) {
            expect(typeof result.error).toBe("string");
        }
    });

    // —— 安全命门：per-diagram %%{init:loose}%% 绕过 strict 后，DOMPurify 兜底 ——
    it("XSS payload（%%{init:loose}%% + <script> + <img onerror> + foreignObject<script>）→ 清理后不含 script/任意 on*/foreignObject", async () => {
        // 模拟攻击者通过 %%{init}%% 强制 loose+htmlLabels 后 mermaid 可能产出的污染 SVG
        const pollutedSvg = `<svg xmlns="http://www.w3.org/2000/svg">
  <script>alert('xss-script')</script>
  <foreignObject width="100" height="100">
    <body xmlns="http://www.w3.org/1999/xhtml">
      <script>alert('foreign-script')</script>
      <img src="x" onerror="alert('foreign-img-onerror')"/>
    </body>
  </foreignObject>
  <image href="x" onerror="alert('image-onerror')"/>
  <rect onclick="alert('rect-onclick')" width="10" height="10"/>
  <g onload="alert('g-onload')"><path d="M0 0"/></g>
  <text onmouseover="alert('text-hover')">label</text>
</svg>`;
        mermaidRender.mockResolvedValue({ svg: pollutedSvg });

        // 源码本身携带试图绕过全局 strict 的 per-diagram 指令（CVE-2026-23630 攻击路径）
        const maliciousSource = `%%{init: {securityLevel: "loose", htmlLabels: true}}%%\ngraph TD; A-->B`;
        const result = await renderMermaid(maliciousSource, "light");

        expect("svg" in result).toBe(true);
        const svg = unwrapSvg(result).toLowerCase();

        // <script> 标签（开/闭）必须消失
        expect(svg).not.toContain("<script");
        expect(svg).not.toContain("</script");
        // foreignObject 整体消失（其内的 HTML+script 一并清除）
        expect(svg).not.toContain("foreignobject");
        // 任意 on* 事件属性必须消失（onerror/onclick/onload/onmouseover 全覆盖）
        expect(svg).not.toMatch(/\son[a-z]+\s*=/i);
        expect(svg).not.toContain("onerror");
        expect(svg).not.toContain("onclick");
        expect(svg).not.toContain("onload");
        expect(svg).not.toContain("onmouseover");
    });

    it("清理后保留合法 SVG 结构（svg/g/rect/path/text 不被误删）", async () => {
        const legitSvg =
            '<svg xmlns="http://www.w3.org/2000/svg"><style>.node{fill:#fff}</style><g class="node"><rect width="10" height="10"/><text>hello</text><path d="M0 0"/></g></svg>';
        mermaidRender.mockResolvedValue({ svg: legitSvg });

        const result = await renderMermaid("graph TD; A-->B", "dark");

        const svg = unwrapSvg(result);
        expect(svg).toContain("<svg");
        expect(svg).toContain("<rect");
        expect(svg).toContain("<path");
        expect(svg).toContain("<text");
        // mermaid 把配色烘焙进 <style>，保留才不花图
        expect(svg).toContain("<style");
    });
});
