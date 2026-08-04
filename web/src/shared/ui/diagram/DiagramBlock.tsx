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
 * 加载体验：chunk 懒加载与 mermaid 渲染两段等待统一为 DiagramPlaceholder 占位
 * 面板（无旋转 spinner）；SVG 就绪后纯 opacity 淡入（不用 transform 动画——
 * transform 会触发 SVG 按当前倍率重栅格化，放大后发虚）。
 *
 * 失败降级：renderMermaid 返回 { error } → 直接复用 FencedCodeBlock 呈现源码。
 * 失败 = 退化回代码呈现，不做错误装饰（告警/边线/提示行都去掉），与文章围栏
 * 代码块同视觉（shiki 高亮 + 语言标签 + 复制按钮），让源码本身成为内容。
 * 不向读者暴露详细错误（作者在编辑弹层看）。
 *
 * 布局：根容器用 block（不 flex）——失败态 FencedCodeBlock 在 flex 容器里会被
 * 收缩为内容宽度（xychart 源码行短时整块仅 ~368px），block 容器让失败态自然
 * 占满父宽。成功态 SVG 居中改在内层 flex wrapper 内部，保留视觉。
 */
import { AnimatePresence } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { FencedCodeBlock } from "@/shared/ui/markdown-preview/components/CodeBlock";
import { DiagramFullscreen } from "./DiagramFullscreen";
import { DiagramPlaceholder } from "./DiagramPlaceholder";
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

function DiagramError({ format, source }: { format: string; source: string }) {
    return <FencedCodeBlock code={source} language={format} />;
}

export function DiagramBlock({ format, source }: DiagramBlockProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    /** 全屏打开前保存焦点元素，关闭后回归（PRD 焦点管理） */
    const fullscreenTriggerRef = useRef<HTMLElement | null>(null);
    const [fullscreen, setFullscreen] = useState(false);
    const [result, setResult] = useState<RenderMermaidResult | null>(null);
    /**
     * 是否已至少成功渲染过一次。
     * - 区分首加载（result===null && !hasRendered → 显示占位）与主题切换重渲染
     *   （result===null 但容器内保留旧帧，不显示占位，保留连续视觉）。
     * - 首次成功挂上后保持 true，fade-in 动画类同帧挂载后永驻：主题切换 result
     *   进出 null 不会重新挂载类，动画不重播。
     */
    const [hasRendered, setHasRendered] = useState(false);
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
            if ("svg" in r) {
                setHasRendered(true);
                if (containerRef.current) containerRef.current.innerHTML = r.svg;
            }
        });
        return () => {
            cancelled = true;
        };
    }, [source, theme]);

    const initialLoading = result === null && !hasRendered;
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
    // 根容器 block 布局：失败态 FencedCodeBlock 在 block 里自然 w-full（不被 flex
    // 收缩为内容宽度）。成功态 DiagramViewport + 居中 wrapper 在块级里仍居中。
    // data-type 与编辑器节点载体同名：批注的 UNANNOTATABLE_SELECTOR 靠它拦截；
    // select-none 使图内文字（SVG text / foreignObject HTML）不可选，从源头
    // 消除划线批注选区与拖拽时的误选。
    return (
        <div className="relative my-6" data-type="diagram-block">
            {errored ? null : (
                <div className="flex justify-center">
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
                            className={cn(
                                "flex min-h-24 w-full select-none justify-center",
                                hasRendered && "animate-diagram-enter",
                            )}
                            role="img"
                            aria-label={extractDiagramLabel(source)}
                        />
                    </DiagramViewport>
                </div>
            )}
            {initialLoading ? <DiagramPlaceholder className="absolute inset-0" /> : null}
            {errored ? <DiagramError format={format} source={source} /> : null}
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
