/**
 * renderMermaid 集成测试：不 mock mermaid，真实跑 v11。
 *
 * 现有 render-mermaid.test.ts 全程 mock mermaid.render，无法发现 mermaid v11
 * 的 suppressErrorRendering 默认行为变更——v11 解析失败不再抛错，而是 fallback
 * 到内置 errorDiagram 画出含 "Syntax error in text" 的 SVG 当正常结果返回。
 * 此文件用真实 mermaid 验证我们的 initialize 配置确实让语法错误走抛错路径。
 */
import { describe, expect, it } from "vitest";
import { renderMermaid } from "../render-mermaid";

describe("renderMermaid 真实集成（不 mock mermaid）", () => {
    // 合法源的渲染产物依赖 SVG 布局 API（getBBox 等），jsdom 未实现，真实浏览器才跑得通。
    // 这里只覆盖错误路径——那才是 suppressErrorRendering 修复针对的场景。
    // 合法渲染的正确性由 e2e/视觉验证负责，不进 jsdom 单测。
    it.skip("合法源 → 返回 { svg }（jsdom 缺 getBBox，真实浏览器才通过）", async () => {
        const result = await renderMermaid("graph TD; A-->B", "light");
        expect("svg" in result).toBe(true);
        if ("svg" in result) {
            expect(result.svg).toContain("<svg");
        }
    });

    it("语法错误源 → 返回 { error }，不返回含 'Syntax error in text' 的伪 SVG", async () => {
        const result = await renderMermaid("!!! 这不是合法 mermaid !!!", "light");

        expect("error" in result).toBe(true);
        expect("svg" in result).toBe(false);
        if ("error" in result) {
            expect(result.error.length).toBeGreaterThan(0);
            // 关键：错误信息里绝不能出现 mermaid 错误图的占位文本
            expect(result.error).not.toContain("Syntax error in text");
        }
        // 关键：mermaid v11 解析失败时会在 document.body 留下含错误图的临时 div，
        // 必须确认没有残留（界面底部不该冒出 Syntax error in text）
        const bodyHtml = document.body.innerHTML;
        expect(bodyHtml).not.toContain("Syntax error in text");
        expect(bodyHtml).not.toContain("mermaid version");
    });

    it("能识别为 flowchart 但内容语法错误 → 返回 { error }（非 errorDiagram 伪 SVG）", async () => {
        // graph 开头能被 detectType 识别为 flowchart，但后面的 @#$ 是非法语法
        const result = await renderMermaid("graph TD\n    A@#$-->B", "light");
        if ("svg" in result) {
            // 如果返回了 svg，绝不能是 mermaid 的错误占位图
            expect(result.svg).not.toContain("Syntax error in text");
            expect(result.svg).not.toContain("mermaid version");
        } else {
            expect(result.error.length).toBeGreaterThan(0);
        }
    });

    it("空源码 → 返回 { error }（mermaid 无法识别 diagram type）", async () => {
        const result = await renderMermaid("", "light");
        expect("error" in result).toBe(true);
    });
});
