/**
 * AnnotationLayer - 正文高亮渲染层。
 *
 * 遍历 located 批注，给对应块级元素加 data-annotation-id 属性 + 高亮 class
 *（块级背景标记，不精确包裹选中文本——精确字符级包裹是后续增强）。
 *
 * 管理滚动联动：监听 window scroll（rAF 合并），算哪个批注块当前在视口顶部，
 * 触发 onActiveChange 让 AnnotationSidebar 高亮对应卡片。
 *
 * PRD-0001「双侧信息层」的正文侧。
 */
import { useEffect, useState } from "react";
import { findBlockElement } from "../lib/extract-blocks";
import type { CandidateBlock } from "../lib/relocate";
import type { LocatedAnnotation } from "../lib/use-annotations";

/** 高亮块的 class（背景 + 左色条 + hover） */
const HIGHLIGHT_CLASS = "annotation-highlight";

export interface AnnotationLayerProps {
    /** 正文容器 ref（与 useAnnotations 的 contentRef 同源） */
    contentRef: React.RefObject<HTMLElement | null>;
    /** located 批注（来自 useAnnotations） */
    located: LocatedAnnotation[];
    /** 候选块列表（来自 useAnnotations） */
    blocks: CandidateBlock[];
    /** 滚动激活的批注 id 变化回调（驱动 Sidebar 卡片高亮） */
    onActiveChange?: (commentId: string | null) => void;
}

export function AnnotationLayer({
    contentRef,
    located,
    blocks,
    onActiveChange,
}: AnnotationLayerProps) {
    const [activeId, setActiveId] = useState<string | null>(null);

    // 1. 给每个 located 批注的对应块加高亮 class + data-annotation-id
    useEffect(() => {
        const root = contentRef.current;
        if (!root || located.length === 0) return;

        let cancelled = false;
        (async () => {
            // 清理旧标记
            root.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => {
                el.classList.remove(HIGHLIGHT_CLASS);
                el.removeAttribute("data-annotation-id");
            });

            // 标记每个 located 批注的块
            for (const ann of located) {
                if (cancelled) return;
                const el = await findBlockElement(root, ann.result.blockId);
                if (el && !cancelled) {
                    el.classList.add(HIGHLIGHT_CLASS);
                    el.setAttribute("data-annotation-id", ann.comment.id);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [contentRef, located]);

    // 2. 滚动联动：监听 window scroll，算当前激活的批注块
    useEffect(() => {
        if (located.length === 0) return;
        const root = contentRef.current;
        if (!root) return;

        let rafId = 0;
        const triggerOffset = 100; // 触发线：距视口顶部 100px

        const update = () => {
            let topVisible: string | null = null;
            let topVisibleY = Infinity;
            for (const ann of located) {
                const el = root.querySelector<HTMLElement>(
                    `[data-annotation-id="${ann.comment.id}"]`,
                );
                if (!el) continue;
                const y = el.getBoundingClientRect().top;
                // 找「已越过触发线且最靠近顶部」的批注块
                if (y <= triggerOffset && y < topVisibleY) {
                    topVisibleY = y;
                    topVisible = ann.comment.id;
                }
            }
            if (topVisible !== activeId) {
                setActiveId(topVisible);
                onActiveChange?.(topVisible);
            }
        };

        const schedule = () => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(update);
        };
        window.addEventListener("scroll", schedule, { passive: true });
        update(); // 初始化

        return () => {
            window.removeEventListener("scroll", schedule);
            cancelAnimationFrame(rafId);
        };
    }, [contentRef, located, activeId, onActiveChange]);

    // 容器无可见内容——仅副作用操作 DOM。blocks 用于未来按需消费（暂留 prop）。
    void blocks;
    return null;
}

export default AnnotationLayer;
