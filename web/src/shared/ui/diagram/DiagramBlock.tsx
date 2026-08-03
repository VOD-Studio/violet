/**
 * DiagramBlock - 图块阅读端渲染组件（浏览时渲染）
 *
 * 由阅读端注册表（renderers.ts）经 React.lazy 引入，仅在文章真含
 * diagram-block 节点时 Suspense 触发拉取 mermaid chunk（PRD 懒加载决策）。
 *
 * 渲染流程：持 ref 容器 → useEffect 调 renderMermaid(source, theme) →
 * 清理后的 SVG 经 innerHTML 写入容器。mermaid 把颜色烘焙进 SVG，切主题
 * 无法 CSS 跟随，故监听 <html>.classList 变化重新 render（参照 particle-field
 * 的 MutationObserver 先例 + herczeg 2025-01 mermaid theming 实践）。
 *
 * 失败降级：renderMermaid 返回 { error } → 显示「图表渲染失败」占位 + 折叠源码，
 * 不向读者暴露详细错误（作者在编辑弹层看具体错误，那是 slice #4 的职责）。
 */
import { useEffect, useRef, useState } from "react";
import { DiagramViewport } from "./DiagramViewport";
import type { DiagramTheme, RenderMermaidResult } from "./render-mermaid";
import { renderMermaid } from "./render-mermaid";

export interface DiagramBlockProps {
    /** 图表格式（首期仅 "mermaid"，预留多格式） */
    format: string;
    /** mermaid 源码（来自 data-source，已 HTML 反转义） */
    source: string;
}

/** 读当前站点主题：<html>.classList 含 dark → dark，否则 light（SSR 安全兜底 light） */
function readCurrentTheme(): DiagramTheme {
    if (typeof document === "undefined") return "light";
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * 渲染失败占位：固定提示 + 折叠源码（<details> 无 JS 也可见，作降级）
 *
 * 不展示 error.message：读者无需、也不应看到 mermaid 内部错误细节。
 */
function DiagramError({ source }: { source: string }) {
    return (
        <figure className="my-6 rounded-lg border border-edge-hairline bg-muted/40 p-4 text-center">
            <figcaption className="text-sm text-muted-foreground">图表渲染失败</figcaption>
            <details className="mt-2 text-left">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    查看源码
                </summary>
                <pre className="code-block-scrollbar mt-2 overflow-x-auto rounded bg-muted p-3 text-xs leading-relaxed">
                    <code>{source}</code>
                </pre>
            </details>
        </figure>
    );
}

export function DiagramBlock({ source }: DiagramBlockProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [result, setResult] = useState<RenderMermaidResult | null>(null);
    const [theme, setTheme] = useState<DiagramTheme>(readCurrentTheme);

    // 主题跟随：mermaid 颜色烘焙进 SVG，切主题必须重新 render。
    // 监听 <html>.classList（next-themes 在此注入 dark），参照 particle-field 先例。
    useEffect(() => {
        const observer = new MutationObserver(() => {
            const next = readCurrentTheme();
            setTheme((prev) => (prev !== next ? next : prev));
        });
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"],
        });
        return () => observer.disconnect();
    }, []);

    // 渲染：source / theme 任一变化即重新 renderMermaid，清理后 SVG 写入容器。
    // 上一轮未决的 promise 由 cancelled 标志作废，避免竞态写入过期 SVG。
    useEffect(() => {
        let cancelled = false;
        setResult(null);
        if (containerRef.current) containerRef.current.innerHTML = "";
        renderMermaid(source, theme).then((r) => {
            if (cancelled) return;
            setResult(r);
            if ("svg" in r && containerRef.current) {
                containerRef.current.innerHTML = r.svg;
            }
        });
        return () => {
            cancelled = true;
        };
    }, [source, theme]);

    const errored = result !== null && !("svg" in result);

    // 复制源码：剪贴板 API 不可用（非安全上下文等）时静默降级，不阻塞渲染
    const [copied, setCopied] = useState(false);
    const copySource = async () => {
        try {
            await navigator.clipboard.writeText(source);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // 剪贴板不可用，忽略
        }
    };

    // 渲染中（mermaid 异步）：容器以 hidden 保持挂载（同一 DOM 元素贯穿两态，
    // 渲染回调写入 containerRef.innerHTML 后才切显示——提前 return 或结构切换
    // 都会让 ref 指向的 DOM 被替换，SVG 写入丢失（图永远空白）。工具条同步隐藏。
    return (
        <div
            className={
                result === null ? "my-6 flex min-h-24 justify-center" : "my-6 flex justify-center"
            }
        >
            {errored ? null : (
                <DiagramViewport
                    onCopySource={copySource}
                    copied={copied}
                    renderToolbar={result !== null}
                >
                    <div
                        ref={containerRef}
                        className={result === null ? "hidden" : "flex justify-center"}
                        role="img"
                        aria-label="流程图"
                    />
                </DiagramViewport>
            )}
            {errored ? <DiagramError source={source} /> : null}
        </div>
    );
}
