/**
 * renderMermaid - mermaid 单图渲染（含 DOMPurify 双重防线）
 *
 * 动态 import mermaid → securityLevel:strict 初始化 → render 拿 SVG →
 * DOMPurify 二次清理。strict 是第一道防线（挡常规注入），DOMPurify 是第二道
 * 兜底——mermaid 支持 per-diagram `%%{init: {securityLevel: "loose"}}%%` 指令
 * 覆盖全局 strict（docmost CVE-2026-23630 / GHSA-r4hj-mc62-jmwj 的存储型 XSS
 * 攻击路径），第二道 DOMPurify 剥掉渲染产物里的 script、foreignObject 及 on* 事件
 * 属性等可执行内容，确保即使 strict 被绕过也无法落盘可执行 SVG。
 *
 * 失败（语法错 / 渲染异常）返回 { error }，不抛出——阅读端据此走降级占位。
 */
import DOMPurify, { type Config } from "dompurify";
import { getThemeVariables, type MermaidThemeVariables } from "./theme-variables";

export type DiagramTheme = "light" | "dark";

export type RenderMermaidResult = { svg: string } | { error: string };

/**
 * DOMPurify 清理配置：SVG 子集 + 显式禁令
 *
 * - USE_PROFILES svg/svgFilters：只放行 SVG 元素子集，HTML 与 foreignObject 的
 *   可执行标签天然不在白名单 → foreignObject 连同其内 HTML/script 一并剥除
 * - FORBID_TAGS script：svg profile 默认已剥 script，这里再钉死，防 profile 漂移
 * - ADD_TAGS style：mermaid 把节点配色/布局烘焙进 SVG 内 <style>，保留才不花图
 * - on* 事件属性：不在 DOMPurify 任何 allow list 中，默认即被剥除（无需列举）
 */
const SANITIZE_CONFIG: Config = {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ["script"],
    ADD_TAGS: ["style"],
};

/** mermaid 模块缓存：首次渲染才动态 import（懒加载，不含图块的文章页不付体积） */
let mermaidLoader: Promise<typeof import("mermaid").default> | null = null;

async function loadMermaid(): Promise<typeof import("mermaid").default> {
    if (!mermaidLoader) {
        mermaidLoader = import("mermaid").then((m) => m.default);
    }
    return mermaidLoader;
}

/** 渲染实例自增 id，保证多次调用互不撞 id */
let renderSeq = 0;

/**
 * renderMermaid - 渲染 mermaid 源码为经 DOMPurify 清理的 SVG 字符串
 *
 * @param source mermaid 源码（可能含恶意 %%{init}%% 指令——由 DOMPurify 兜底）
 * @param theme  'light' | 'dark'，决定 themeVariables 明暗（默认 light）
 * @returns 成功 { svg }（已清理），失败 { error }（错误信息字符串）
 */
export async function renderMermaid(
    source: string,
    theme: DiagramTheme = "light",
): Promise<RenderMermaidResult> {
    try {
        const mermaid = await loadMermaid();
        const themeVariables: MermaidThemeVariables = getThemeVariables(theme === "dark");
        mermaid.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            theme: "base",
            themeVariables,
            // suppressErrorRendering: true — mermaid v11 默认 false，解析失败时不抛错，
            // 而是路由到内置 errorDiagram 把含 "Syntax error in text" + "mermaid version"
            // 的错误图画进挂在 document.body 的临时 div，事后虽会 throw，但 throw 前不
            // 清理该临时 div → 残留在页面底部（mermaid.esm.mjs:1670-1679 / 1718-1719）。
            // 我们有自己的 DiagramError 占位降级，要 mermaid 在画错误图之前就抛错，
            // 由下方 try/catch 捕获返回 { error }。
            suppressErrorRendering: true,
        });
        const id = `diagram-render-${++renderSeq}`;
        const { svg } = await mermaid.render(id, source);
        return { svg: DOMPurify.sanitize(svg, SANITIZE_CONFIG) as string };
    } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
    }
}
