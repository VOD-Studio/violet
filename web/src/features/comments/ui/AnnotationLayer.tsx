/**
 * AnnotationLayer - 正文批注角标 + 气泡层。
 *
 * 方案（修复「侧边栏挤压内容」bug）：不再用常驻侧边栏，改为
 *   - 给每个批注块在左外边距注入「角标」按钮（显示批注数，不遮挡文字）
 *   - 点击角标展开该块的「行内气泡」（AnnotationCard 列表），气泡跟随块定位
 *   - 默认不显示任何面板，零挤压
 *
 * 性能关键（修复「滚动延迟不跟手」bug）：
 *   角标位置更新走 **直接 DOM 操作**（scroll handler 内改 style.top/left），
 *   跳过 React setState + reconciliation 管线——这是高频位置更新的标准做法。
 *   React 只负责挂载/卸载角标元素，位置由 scroll handler 实时写 DOM。
 *
 * AnnotationLayer 也负责给批注块加高亮 class（视觉标记「这段有批注」）。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { findBlockElement } from "../lib/extract-blocks";
import type { CandidateBlock } from "../lib/relocate";
import type { LocatedAnnotation } from "../lib/use-annotations";
import { AnnotationCard } from "./AnnotationCard";

/** 高亮块的 class（背景 + 左色条） */
const HIGHLIGHT_CLASS = "annotation-highlight";

/** 角标水平偏移：放在块左外边距，距块左边 -32px（角标宽 24px + 8px 间隙） */
const MARKER_OFFSET_X = -32;
/** 角标垂直偏移：距块顶部 4px */
const MARKER_OFFSET_Y = 4;

/** 单个批注块（仅记录 React 渲染所需的最小数据；位置不进 state，DOM 直接操作） */
interface BlockMarker {
    id: string; // blockId
    annotations: LocatedAnnotation[];
    element: HTMLElement;
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
    const [bubbleVisible, setBubbleVisible] = useState(false);

    // 角标 DOM 引用（blockId → button element），scroll 时直接改 style 跳过 React 渲染。
    const markerElsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
    // 气泡 DOM 引用，scroll 时同样直接改 style。
    const bubbleElRef = useRef<HTMLDivElement | null>(null);
    // 当前激活块的 element 引用（气泡跟随它定位用）。
    const activeBlockElRef = useRef<HTMLElement | null>(null);

    void blocks; // 保留 prop 兼容，本期未直接消费

    // 1. 按 blockId 分组批注 + 找对应 DOM 元素 + 加高亮 class
    useEffect(() => {
        const root = contentRef.current;
        if (!root || located.length === 0) {
            setMarkers([]);
            root?.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => {
                el.classList.remove(HIGHLIGHT_CLASS);
            });
            markerElsRef.current.clear();
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
                    el.classList.add(HIGHLIGHT_CLASS);
                    next.push({ id: blockId, annotations: anns, element: el });
                }
            }
            if (cancelled) return;
            // markers 引用变化会触发 React 渲染挂载角标；挂载后 useEffect 同步位置（见下）
            setMarkers(next);
        })();

        return () => {
            cancelled = true;
        };
    }, [contentRef, located]);

    // 2. 角标挂载后立即同步一次位置（避免首帧闪在 0,0）
    useEffect(() => {
        for (const marker of markers) {
            const el = markerElsRef.current.get(marker.id);
            if (el) positionMarker(el, marker.element);
        }
    }, [markers]);

    // 3. 监听 scroll/resize，直接改 DOM style 更新角标 + 气泡位置（跳过 React 渲染管线）
    useEffect(() => {
        if (markers.length === 0) return;

        let rafId = 0;
        const update = () => {
            // 直接改 DOM style，不触发 React 重渲染——这是滚动跟手的关键。
            for (const marker of markers) {
                const el = markerElsRef.current.get(marker.id);
                if (el) positionMarker(el, marker.element);
            }
            // 气泡跟随激活块
            if (activeBlockElRef.current && bubbleElRef.current) {
                positionBubble(bubbleElRef.current, activeBlockElRef.current);
            }
        };
        const schedule = () => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(update);
        };
        // capture: true 捕获阶段，避免被正文内 stopPropagation 拦截
        window.addEventListener("scroll", schedule, { passive: true, capture: true });
        window.addEventListener("resize", schedule, { passive: true });
        return () => {
            window.removeEventListener("scroll", schedule, { capture: true });
            window.removeEventListener("resize", schedule);
            cancelAnimationFrame(rafId);
        };
    }, [markers]);

    /** 点击角标：展开/收起气泡 */
    const handleMarkerClick = useCallback((marker: BlockMarker) => {
        setActiveBlockId((cur) => {
            const next = cur === marker.id ? null : marker.id;
            activeBlockElRef.current = next ? marker.element : null;
            setBubbleVisible(next !== null);
            return next;
        });
    }, []);

    // 当前展开的批注组
    const activeMarker = activeBlockId ? markers.find((m) => m.id === activeBlockId) : null;

    // 气泡挂载后立即定位 + 同步 ref
    const setBubbleRef = (el: HTMLDivElement | null) => {
        bubbleElRef.current = el;
        if (el && activeBlockElRef.current) {
            positionBubble(el, activeBlockElRef.current);
        }
    };

    return (
        <>
            {/* 角标层：每个批注块左外边距的数字按钮，fixed 定位由 scroll handler 直接写 style */}
            {markers.map((marker) => {
                const isActive = marker.id === activeBlockId;
                return (
                    <button
                        key={marker.id}
                        type="button"
                        ref={(el) => {
                            if (el) markerElsRef.current.set(marker.id, el);
                            else markerElsRef.current.delete(marker.id);
                        }}
                        onClick={() => handleMarkerClick(marker)}
                        className={`fixed z-30 flex size-6 items-center justify-center rounded-full text-xs font-medium shadow-md transition-colors hover:scale-110 ${
                            isActive ? "bg-blue-600 text-white" : "bg-blue-500/90 text-white"
                        }`}
                        aria-label={`${marker.annotations.length} 条批注`}
                        title={`${marker.annotations.length} 条批注`}
                    >
                        {marker.annotations.length}
                    </button>
                );
            })}

            {/* 气泡：点击角标后展开，portal 到 body 避免被正文 overflow 裁剪；
                位置由 scroll handler 跟随激活块直接写 style */}
            {activeMarker && bubbleVisible && (
                <div
                    ref={setBubbleRef}
                    className="fixed z-50 w-80 max-w-[calc(100vw-2rem)] space-y-2 rounded-lg border border-edge-hairline bg-card p-3 shadow-xl"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                            {activeMarker.annotations.length} 条批注
                        </span>
                        <button
                            type="button"
                            onClick={() => {
                                setActiveBlockId(null);
                                activeBlockElRef.current = null;
                                setBubbleVisible(false);
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
                </div>
            )}
        </>
    );
}

/** 直接写角标 DOM style 定位（左外边距，不遮挡文字） */
function positionMarker(markerEl: HTMLButtonElement, blockEl: HTMLElement) {
    const r = blockEl.getBoundingClientRect();
    markerEl.style.top = `${r.top + MARKER_OFFSET_Y}px`;
    markerEl.style.left = `${r.left + MARKER_OFFSET_X}px`;
}

/** 直接写气泡 DOM style 定位（块下方 8px，水平 clamp 防溢出） */
function positionBubble(bubbleEl: HTMLDivElement, blockEl: HTMLElement) {
    const r = blockEl.getBoundingClientRect();
    bubbleEl.style.top = `${r.bottom + 8}px`;
    // 气泡宽 320（w-80），clamp 防止溢出视口
    bubbleEl.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 328))}px`;
}

export default AnnotationLayer;
