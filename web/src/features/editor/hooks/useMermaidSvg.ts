/**
 * useMermaidSvg - mermaid 异步渲染（带取消 + 保留上一帧防闪烁）
 *
 * 与公式的同步 renderKatexElement 不同，renderMermaid 返回 Promise。本 hook 负责：
 * - source/theme 变化即重渲（实时预览）
 * - 新渲染在途时取消旧的（rapid typing 下最后一次输入胜出，避免竞态覆盖）
 * - 渲染期间保留上一次成功的 SVG（lastSvgRef），不在每次按键时闪 loading
 * - 失败返回 error 字符串（弹层内联显示，便于作者修；阅读端据此走降级占位）
 *
 * DOMPurify 双重防线在 renderMermaid 内部已落实，此处拿到的 svg 可直接写 innerHTML。
 */
import { useEffect, useRef, useState } from "react";
import { type DiagramTheme, renderMermaid } from "@/shared/ui/diagram";

export interface MermaidRenderState {
    /** 最近一次成功渲染的 SVG（null=从未成功或源码为空） */
    svg: string | null;
    /** 最近一次错误信息（null=ok 或 loading） */
    error: string | null;
    /** 是否正在渲染 */
    loading: boolean;
}

const EMPTY: MermaidRenderState = { svg: null, error: null, loading: false };

/**
 * @param source mermaid 源码
 * @param theme  'light' | 'dark'
 */
export function useMermaidSvg(source: string, theme: DiagramTheme): MermaidRenderState {
    const [state, setState] = useState<MermaidRenderState>(() =>
        source.trim() ? { svg: null, error: null, loading: true } : EMPTY,
    );
    /** 跨渲染保留上一次成功 SVG，渲染在途时继续展示它，避免每次按键闪 loading */
    const lastSvgRef = useRef<string | null>(null);

    useEffect(() => {
        if (!source.trim()) {
            lastSvgRef.current = null;
            setState(EMPTY);
            return;
        }
        let cancelled = false;
        // 进入 loading：svg 沿用上一帧（若有），不闪空白
        setState({ svg: lastSvgRef.current, error: null, loading: true });
        renderMermaid(source, theme).then((result) => {
            if (cancelled) return;
            if ("svg" in result) {
                lastSvgRef.current = result.svg;
                setState({ svg: result.svg, error: null, loading: false });
            } else {
                setState({ svg: lastSvgRef.current, error: result.error, loading: false });
            }
        });
        return () => {
            cancelled = true;
        };
    }, [source, theme]);

    return state;
}
