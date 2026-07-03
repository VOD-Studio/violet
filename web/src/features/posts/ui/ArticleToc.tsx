import { type TocItem, useActiveHeading } from "@shared/lib/hooks/use-toc";
import { ScrollArea } from "@shared/ui/scroll-area";
import { ChevronRight } from "lucide-react";
import { type RefObject, useCallback, useEffect, useMemo, useState } from "react";

export interface ArticleTocProps {
    items: TocItem[];
    /** 文章内容容器 ref，用于监听滚动与查找 heading */
    contentRef: RefObject<HTMLElement | null>;
    /** 点击某条目后的回调，移动端用于关闭 Sheet */
    onNavigate?: () => void;
    /** 隐藏内部 Contents 标题，外层已提供标题时使用 */
    hideTitle?: boolean;
}

interface TocNode extends TocItem {
    children: TocNode[];
}

/** 每个层级的缩进与字号 */
const LEVEL_CONFIG: Record<2 | 3 | 4, { indent: string; text: string }> = {
    2: { indent: "pl-2", text: "text-sm" },
    3: { indent: "pl-5", text: "text-sm" },
    4: { indent: "pl-8", text: "text-xs" },
};

/** 把扁平标题列表按 level 还原为父子树，并记录每个节点的父节点 id */
function buildTree(items: TocItem[]): { tree: TocNode[]; parentMap: Map<string, string> } {
    const tree: TocNode[] = [];
    const parentMap = new Map<string, string>();
    const stack: TocNode[] = [];

    for (const item of items) {
        const node: TocNode = { ...item, children: [] };

        while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
            stack.pop();
        }

        if (stack.length === 0) {
            tree.push(node);
        } else {
            const parent = stack[stack.length - 1];
            parent.children.push(node);
            parentMap.set(node.id, parent.id);
        }

        stack.push(node);
    }

    return { tree, parentMap };
}

/**
 * ArticleToc - 详情页动态目录，可折叠图标节点树
 *
 * spec：
 * - 有子级的节点显示 chevron，点击可展开/折叠
 * - 叶子节点显示圆点
 * - 点击标题平滑滚动到对应 heading
 * - 当前高亮项的父级路径自动展开
 * - 与阅读进度同步高亮当前 heading
 */
const ArticleToc = ({ items, contentRef, onNavigate, hideTitle }: ArticleTocProps) => {
    const active = useActiveHeading(contentRef);
    const { tree, parentMap } = useMemo(() => buildTree(items), [items]);
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

    const toggle = useCallback((id: string) => {
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleClick = useCallback(
        (id: string) => {
            const el = document.getElementById(id);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "start" });
            }
            onNavigate?.();
        },
        [onNavigate],
    );

    /** 高亮项变化时自动展开其所有父级 */
    useEffect(() => {
        if (!active) return;
        setCollapsed((prev) => {
            const next = new Set(prev);
            let id = active;
            while (parentMap.has(id)) {
                const pid = parentMap.get(id);
                if (!pid) break;
                next.delete(pid);
                id = pid;
            }
            return next;
        });
    }, [active, parentMap]);

    if (!items.length) return null;

    return (
        <nav aria-label="目录" className="flex h-full flex-col">
            {hideTitle ? null : (
                <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Contents
                </p>
            )}
            <ScrollArea className="flex-1">
                <ul className="space-y-0.5">
                    {tree.map((node) => (
                        <TreeNode
                            key={node.id}
                            node={node}
                            active={active}
                            collapsed={collapsed}
                            onToggle={toggle}
                            onNavigate={handleClick}
                        />
                    ))}
                </ul>
            </ScrollArea>
        </nav>
    );
};

interface TreeNodeProps {
    node: TocNode;
    active: string | null;
    collapsed: Set<string>;
    onToggle: (id: string) => void;
    onNavigate: (id: string) => void;
}

function TreeNode({ node, active, collapsed, onToggle, onNavigate }: TreeNodeProps) {
    const isActive = active === node.id;
    const isCollapsed = collapsed.has(node.id);
    const cfg = LEVEL_CONFIG[node.level];
    const hasChildren = node.children.length > 0;

    return (
        <li>
            <div
                className={
                    "group relative flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 transition-colors " +
                    `${cfg.indent} ${cfg.text} ` +
                    (isActive
                        ? "bg-accent/60 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent/40 hover:text-foreground")
                }
            >
                {isActive ? (
                    <span
                        aria-hidden
                        className="absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-full bg-neon-blue"
                    />
                ) : null}

                {hasChildren ? (
                    <button
                        type="button"
                        onClick={() => onToggle(node.id)}
                        aria-label={isCollapsed ? "展开" : "折叠"}
                        aria-expanded={!isCollapsed}
                        className="flex size-4 shrink-0 items-center justify-center rounded-sm hover:bg-accent"
                    >
                        <ChevronRight
                            aria-hidden
                            className={
                                "size-3 shrink-0 transition-transform " +
                                (node.level === 3 ? "opacity-60 " : "") +
                                (isActive
                                    ? "text-neon-blue"
                                    : "text-muted-foreground/60 group-hover:text-muted-foreground") +
                                (isCollapsed ? "" : " rotate-90")
                            }
                        />
                    </button>
                ) : (
                    <span
                        aria-hidden
                        className="flex size-4 shrink-0 items-center justify-center"
                    >
                        <span
                            className={
                                "size-1.5 rounded-full " +
                                (isActive
                                    ? "bg-neon-blue"
                                    : "bg-muted-foreground/40 group-hover:bg-muted-foreground/70")
                            }
                        />
                    </span>
                )}

                <button
                    type="button"
                    onClick={() => onNavigate(node.id)}
                    className="flex-1 truncate text-left"
                >
                    {node.text}
                </button>
            </div>

            {hasChildren && !isCollapsed ? (
                <ul className="space-y-0.5">
                    {node.children.map((child) => (
                        <TreeNode
                            key={child.id}
                            node={child}
                            active={active}
                            collapsed={collapsed}
                            onToggle={onToggle}
                            onNavigate={onNavigate}
                        />
                    ))}
                </ul>
            ) : null}
        </li>
    );
}

export default ArticleToc;
