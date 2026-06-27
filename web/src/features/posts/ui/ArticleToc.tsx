import { type TocItem, useActiveHeading } from "@shared/lib/hooks/use-toc";
import { ScrollArea } from "@shared/ui/scroll-area";
import type { RefObject } from "react";

export interface ArticleTocProps {
    items: TocItem[];
    /** 文章内容容器 ref（用于监听滚动 + 查 heading） */
    contentRef: RefObject<HTMLElement | null>;
}

/**
 * ArticleToc - 详情页动态目录（左侧侧栏 25%）
 *
 * spec：
 * - 左侧 xunrua 上移作 Logo（由父页面渲染，本组件只画 TOC）
 * - TOC 与阅读进度同步高亮当前 heading（useActiveHeading）
 * - 上下渐隐遮罩（ScrollArea）
 */
const ArticleToc = ({ items, contentRef }: ArticleTocProps) => {
    const active = useActiveHeading(contentRef);

    if (!items.length) return null;

    return (
        <nav aria-label="目录" className="flex h-full flex-col">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Contents
            </p>
            <ScrollArea className="flex-1">
                <ul className="space-y-1.5 border-l border-edge-hairline">
                    {items.map((it) => {
                        const isActive = active === it.id;
                        return (
                            <li key={it.id} className={it.level === 3 ? "ml-4" : ""}>
                                <a
                                    href={`#${it.id}`}
                                    className={
                                        "block border-l-2 px-3 py-1 text-sm transition-colors " +
                                        (it.level === 3 ? "pl-5 text-xs" : "") +
                                        (isActive
                                            ? " -ml-px border-neon-blue font-medium text-foreground"
                                            : " border-transparent text-muted-foreground hover:text-foreground")
                                    }
                                >
                                    {it.text}
                                </a>
                            </li>
                        );
                    })}
                </ul>
            </ScrollArea>
        </nav>
    );
};

export default ArticleToc;
