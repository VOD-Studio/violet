/**
 * AnnotationLayer - 正文批注角标 + 气泡层。
 *
 * 方案（修复「侧边栏挤压内容」bug）：不再用常驻侧边栏，改为
 *   - 给每个批注块在右上角注入一个「角标」按钮（显示批注数）
 *   - 点击角标展开该块的「行内气泡」（AnnotationCard 列表），气泡跟随块定位
 *   - 默认不显示任何面板，零挤压
 *
 * 实现：角标和气泡都是 React 渲染的 absolute 定位元素，挂在一个相对定位的 wrapper 里
 *（wrapper 由本组件返回，包在正文外）。块位置通过 getBoundingClientRect 测量，
 * 监听 scroll/resize 更新（rAF 合并）。
 *
 * AnnotationLayer 也负责给批注块加高亮 class（视觉标记「这段有批注」）。
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { findBlockElement } from "../lib/extract-blocks";
import type { CandidateBlock } from "../lib/relocate";
import type { LocatedAnnotation } from "../lib/use-annotations";
import { AnnotationCard } from "./AnnotationCard";

/** 高亮块的 class（背景 + 左色条） */
const HIGHLIGHT_CLASS = "annotation-highlight";

/** 单个批注块的位置测量结果 */
interface BlockMarker {
    /** 批注块对应的 located 列表（同一块可能有多条批注） */
    annotations: LocatedAnnotation[];
    /** 块的 DOM 元素（用于滚动定位 + 高亮 class） */
    element: HTMLElement;
    /** 块在 viewport 中的位置（px），rAF 更新 */
    rect: { top: number; left: number; width: number; height: number };
}

export interface AnnotationLayerProps {
    /** 正文容器 ref */
    contentRef: React.RefObject<HTMLElement | null>;
    /** located 批注（来自 useAnnotations） */
    located: LocatedAnnotation[];
    /** 候选块列表（保留 prop，暂未直接消费） */
    blocks: CandidateBlock[];
    /** 滚动激活回调（保留兼容，气泡方案下可空） */
    onActiveChange?: (commentId: string | null) => void;
}

export function AnnotationLayer({ contentRef, located, blocks }: AnnotationLayerProps) {
    const [markers, setMarkers] = useState<BlockMarker[]>([]);
    const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
    const [bubblePos, setBubblePos] = useState<{ top: number; left: number } | null>(null);
    const markersRef = useRef<BlockMarker[]>([]);

    void blocks; // 保留 prop 兼容，本期未直接消费

    // 1. 按 blockId 分组批注 + 找对应 DOM 元素
    useEffect(() => {
        const root = contentRef.current;
        if (!root || located.length === 0) {
            setMarkers([]);
            // 清理高亮 class
            root?.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => {
                el.classList.remove(HIGHLIGHT_CLASS);
            });
            return;
        }

        let cancelled = false;
        (async () => {
            // 清理旧高亮
            root.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => {
                el.classList.remove(HIGHLIGHT_CLASS);
            });

            // 按 blockId 分组
            const groupByBlock = new Map<string, LocatedAnnotation[]>();
            for (const ann of located) {
                const list = groupByBlock.get(ann.result.blockId) ?? [];
                list.push(ann);
                groupByBlock.set(ann.result.blockId, list);
            }

            const next: BlockMarker[] = [];
            for (const [blockId, anns] of groupByBlock) {
                if (cancelled) return;
                const el = await findBlockElement(root, blockId);
                if (el && !cancelled) {
                    // 加高亮 class
                    el.classList.add(HIGHLIGHT_CLASS);
                    next.push({
                        annotations: anns,
                        element: el,
                        rect: getRect(el),
                    });
                }
            }
            if (cancelled) return;
            markersRef.current = next;
            setMarkers(next);
        })();

        return () => {
            cancelled = true;
        };
    }, [contentRef, located]);

    // 2. 监听 scroll/resize 更新角标位置（rAF 合并）
    useLayoutEffect(() => {
        if (markers.length === 0) return;

        let rafId = 0;
        const update = () => {
            setMarkers((prev) => prev.map((m) => ({ ...m, rect: getRect(m.element) })));
        };
        const schedule = () => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(update);
        };
        window.addEventListener("scroll", schedule, { passive: true, capture: true });
        window.addEventListener("resize", schedule);
        return () => {
            window.removeEventListener("scroll", schedule, { capture: true });
            window.removeEventListener("resize", schedule);
            cancelAnimationFrame(rafId);
        };
    }, [markers.length]);

    /** 点击角标：展开/收起气泡 */
    const handleMarkerClick = useCallback((marker: BlockMarker) => {
        setActiveBlockId((cur) => {
            const next =
                cur === marker.annotations[0].result.blockId
                    ? null
                    : marker.annotations[0].result.blockId;
            if (next) {
                // 气泡定位到块下方
                setBubblePos({
                    top: marker.rect.top + marker.rect.height + 8,
                    left: marker.rect.left,
                });
            } else {
                setBubblePos(null);
            }
            return next;
        });
    }, []);

    // 当前展开的批注组
    const activeMarker = activeBlockId
        ? markers.find((m) => m.annotations[0].result.blockId === activeBlockId)
        : null;

    return (
        <>
            {/* 角标层：每个批注块右上角的数字按钮，fixed 定位跟随块 */}
            {markers.map((marker) => {
                const blockId = marker.annotations[0].result.blockId;
                const isActive = blockId === activeBlockId;
                return (
                    <button
                        key={blockId}
                        type="button"
                        onClick={() => handleMarkerClick(marker)}
                        className={`fixed z-30 flex size-6 items-center justify-center rounded-full text-xs font-medium shadow-md transition-all hover:scale-110 ${
                            isActive
                                ? "bg-blue-500 text-white"
                                : "bg-blue-500/90 text-white hover:bg-blue-600"
                        }`}
                        style={{
                            top: marker.rect.top + 4,
                            left: marker.rect.left + marker.rect.width - 28,
                        }}
                        aria-label={`${marker.annotations.length} 条批注`}
                        title={`${marker.annotations.length} 条批注`}
                    >
                        {marker.annotations.length}
                    </button>
                );
            })}

            {/* 气泡：点击角标后展开，portal 到 body 避免被正文 overflow 裁剪 */}
            {activeMarker &&
                bubblePos &&
                createPortal(
                    <div
                        className="fixed z-50 w-80 max-w-[calc(100vw-2rem)] space-y-2 rounded-lg border border-edge-hairline bg-card p-3 shadow-xl"
                        style={{
                            top: bubblePos.top,
                            left: Math.min(bubblePos.left, window.innerWidth - 320),
                        }}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">
                                {activeMarker.annotations.length} 条批注
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveBlockId(null);
                                    setBubblePos(null);
                                }}
                                className="text-muted-foreground hover:text-foreground"
                                aria-label="关闭"
                            >
                                ×
                            </button>
                        </div>
                        {activeMarker.annotations.map((ann) => (
                            <AnnotationCard
                                key={ann.comment.id}
                                comment={ann.comment}
                                selectedText={ann.result.selectedText}
                            />
                        ))}
                    </div>,
                    document.body,
                )}
        </>
    );
}

/** 测量元素在 viewport 中的位置（fixed 定位用，不加 scroll 偏移） */
function getRect(el: HTMLElement) {
    const r = el.getBoundingClientRect();
    return {
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
    };
}

export default AnnotationLayer;
