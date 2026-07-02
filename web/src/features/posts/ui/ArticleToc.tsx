import { type TocItem, useActiveHeading } from "@shared/lib/hooks/use-toc";
import { ScrollArea } from "@shared/ui/scroll-area";
import { ChevronRight } from "lucide-react";
import type { RefObject } from "react";

export interface ArticleTocProps {
    items: TocItem[];
    /** 文章内容容器 ref（用于监听滚动 + 查 heading） */
    contentRef: RefObject<HTMLElement | null>;
    /** 点击某条目后的回调（移动端用于关闭 Sheet） */
    onNavigate?: () => void;
}

/** 每个层级的呈现：缩进、字号、节点图标类型。集中所有层级差异，避免散落的分支。 */
const LEVEL_CONFIG: Record<2 | 3 | 4, { indent: string; text: string; marker: "chevron" | "dot" }> =
    {
        2: { indent: "pl-2", text: "text-sm", marker: "chevron" },
        3: { indent: "pl-5", text: "text-sm", marker: "chevron" },
        4: { indent: "pl-8", text: "text-xs", marker: "dot" },
    };

/**
 * ArticleToc - 详情页动态目录（图标节点树）
 *
 * spec：
 * - 图标节点树：每级 chevron 缩进，当前章节加粗 + 高亮条 + 背景块
 * - 点击平滑滚动到对应 heading（scrollIntoView），偏移由全局 scroll-mt 负责
 * - 与阅读进度同步高亮当前 heading（useActiveHeading，IntersectionObserver）
 * - 上下渐隐遮罩（ScrollArea）
 */
const ArticleToc = ({ items, contentRef, onNavigate }: ArticleTocProps) => {
    const active = useActiveHeading(contentRef);

    if (!items.length) return null;

    const handleClick = (id: string) => {
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        onNavigate?.();
    };

    return (
        <nav aria-label="目录" className="flex h-full flex-col">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Contents
            </p>
            <ScrollArea className="flex-1">
                <ul className="space-y-0.5">
                    {items.map((it) => {
                        const isActive = active === it.id;
                        const cfg = LEVEL_CONFIG[it.level];
                        return (
                            <li key={it.id}>
                                <button
                                    type="button"
                                    onClick={() => handleClick(it.id)}
                                    className={
                                        "group relative flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left transition-colors " +
                                        `${cfg.indent} ${cfg.text} ` +
                                        (isActive
                                            ? "bg-accent/60 font-medium text-foreground"
                                            : "text-muted-foreground hover:bg-accent/40 hover:text-foreground")
                                    }
                                >
                                    {/* 左侧高亮条（仅当前项） */}
                                    {isActive ? (
                                        <span
                                            aria-hidden
                                            className="absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-full bg-neon-blue"
                                        />
                                    ) : null}
                                    {/* 节点图标：H2/H3 用 chevron，H4 用小圆点 */}
                                    {cfg.marker === "dot" ? (
                                        <span
                                            aria-hidden
                                            className={
                                                "size-1 shrink-0 rounded-full " +
                                                (isActive
                                                    ? "bg-neon-blue"
                                                    : "bg-muted-foreground/40 group-hover:bg-muted-foreground/70")
                                            }
                                        />
                                    ) : (
                                        <ChevronRight
                                            aria-hidden
                                            className={
                                                "size-3 shrink-0 transition-transform " +
                                                (it.level === 3 ? "opacity-60 " : "") +
                                                (isActive
                                                    ? "text-neon-blue"
                                                    : "text-muted-foreground/60 group-hover:text-muted-foreground")
                                            }
                                        />
                                    )}
                                    <span className="truncate">{it.text}</span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </ScrollArea>
        </nav>
    );
};

export default ArticleToc;
