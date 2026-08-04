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
import { TriangleAlert } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { DiagramFullscreen } from "./DiagramFullscreen";
import { DiagramViewport } from "./DiagramViewport";
import { extractDiagramLabel } from "./label";
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
 * 视觉对齐未注册格式的 DiagramSourceFallback：提示行（图标 + muted 小字）
 * + 深色代码块源码，与围栏代码块同一视觉族，不做独立卡片。
 */
function DiagramError({ source }: { source: string }) {
    return (
        <figure className="my-6 w-full">
            <figcaption className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <TriangleAlert className="size-4" aria-hidden />
                图表渲染失败
            </figcaption>
            <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    查看源码
                </summary>
                <pre className="code-block-scrollbar mt-2 overflow-x-auto rounded-lg border border-edge-hairline bg-[#24292e] px-4 py-3 text-sm leading-relaxed text-white/90">
                    <code>{source}</code>
                </pre>
            </details>
        </figure>
    );
}

export function DiagramBlock({ source }: DiagramBlockProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    /** 全屏打开前保存焦点元素，关闭后回归（PRD 焦点管理） */
    const fullscreenTriggerRef = useRef<HTMLElement | null>(null);
    const [fullscreen, setFullscreen] = useState(false);
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
    // 不清空 containerRef：重渲染（主题切换）时保留上一帧 SVG，新 SVG 就绪后覆盖，
    // 避免切主题瞬间整块变白。
    useEffect(() => {
        let cancelled = false;
        setResult(null);
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

    const loading = result === null;
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

    // 容器结构全程稳定：加载与加载完用同一 DOM，仅内容填充不同。
    // containerRef 始终 min-h-24（加载时撑住 96px 防凹陷，加载完 SVG 撑开后
    // min-h 不限制更高内容）→ 零尺寸跳变。spinner 绝对定位覆盖在空容器中央。
    // data-type 与编辑器节点载体同名：批注的 UNANNOTATABLE_SELECTOR 靠它拦截
    // （markdown-components 分发时原 data-type div 被组件整体替换，需在此补回）；
    // select-none 使图内文字（SVG text / foreignObject HTML）不可选，从源头
    // 消除划线批注选区与拖拽时的误选。
    return (
        <div className="relative my-6 flex justify-center" data-type="diagram-block">
            {errored ? null : (
                <DiagramViewport
                    onCopySource={copySource}
                    copied={copied}
                    exportSvg={result && "svg" in result ? result.svg : undefined}
                    onFullscreen={() => {
                        fullscreenTriggerRef.current =
                            (document.activeElement as HTMLElement) ?? null;
                        setFullscreen(true);
                    }}
                >
                    <div
                        ref={containerRef}
                        className="flex min-h-24 select-none justify-center"
                        role="img"
                        aria-label={extractDiagramLabel(source)}
                    />
                </DiagramViewport>
            )}
            {loading ? (
                <div
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    aria-live="polite"
                >
                    <div className="size-5 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
                </div>
            ) : null}
            {errored ? <DiagramError source={source} /> : null}
            <AnimatePresence>
                {fullscreen && result && "svg" in result ? (
                    <DiagramFullscreen
                        svg={result.svg}
                        label={extractDiagramLabel(source)}
                        onClose={() => setFullscreen(false)}
                        triggerRef={fullscreenTriggerRef}
                    />
                ) : null}
            </AnimatePresence>
        </div>
    );
}
