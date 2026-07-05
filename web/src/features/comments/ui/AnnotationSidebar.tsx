/**
 * AnnotationSidebar - 桌面 2xl+ 右侧浮动批注栏。
 *
 * 接入方式（PRD-0001 Issue-0005 决策）：右浮动不重构。
 * 用 sticky 定位脱离文档流，避免重构 $slug.tsx 两栏布局。
 * 仅 2xl+ 显示（小屏降级为 AnnotationInlineBubble）。
 *
 * 联动：
 *   - 点击卡片 → 滚动到正文高亮（findBlockElement + scrollIntoView）
 *   - 正文滚动 → activeId 变化 → 对应卡片亮起（由 AnnotationLayer 的 onActiveChange 驱动）
 */
import { findBlockElement } from "../lib/extract-blocks";
import type { LocatedAnnotation } from "../lib/use-annotations";
import { AnnotationCard } from "./AnnotationCard";

export interface AnnotationSidebarProps {
    /** 正文容器 ref（点击卡片时滚动定位用） */
    contentRef: React.RefObject<HTMLElement | null>;
    /** located 批注（来自 useAnnotations） */
    located: LocatedAnnotation[];
    /** 当前滚动激活的批注 id（来自 AnnotationLayer.onActiveChange） */
    activeId: string | null;
    /** 是否在加载（relocate 中） */
    isLoading?: boolean;
}

export function AnnotationSidebar({
    contentRef,
    located,
    activeId,
    isLoading,
}: AnnotationSidebarProps) {
    if (located.length === 0 && !isLoading) return null;

    /** 点击卡片：滚到正文对应高亮块 */
    const handleCardClick = async (blockId: string) => {
        const root = contentRef.current;
        if (!root) return;
        const el = await findBlockElement(root, blockId);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    return (
        <aside
            className="sticky top-24 ml-4 hidden w-72 shrink-0 self-start overflow-y-auto 2xl:block"
            style={{ maxHeight: "calc(100vh - 8rem)" }}
            aria-label="批注侧边栏"
        >
            <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <span>批注</span>
                <span className="font-mono tabular-nums">{located.length}</span>
            </div>
            {isLoading ? (
                <p className="text-xs text-muted-foreground">定位批注中…</p>
            ) : (
                <div className="space-y-2">
                    {located.map((ann) => (
                        <AnnotationCard
                            key={ann.comment.id}
                            comment={ann.comment}
                            selectedText={ann.result.selectedText}
                            active={ann.comment.id === activeId}
                            onClick={() => handleCardClick(ann.result.blockId)}
                        />
                    ))}
                </div>
            )}
        </aside>
    );
}

export default AnnotationSidebar;
