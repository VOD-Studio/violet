import { cn } from "@shared/lib/utils";
import { Dialog, DialogContent } from "@shared/ui/dialog";
import * as React from "react";

export interface CommandListProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    items: Array<{
        id: string;
        label: string;
        group: string;
        run: () => void;
    }>;
    query: string;
    onQueryChange: (v: string) => void;
}

/**
 * CommandList - 基于 Radix Dialog 的毛玻璃命令面板内核
 *
 * 毛玻璃（backdrop-blur）+ 半透明卡，items 分组渲染。
 * 上/下键导航由父组件状态控制（此处简化为列表 + 点击执行）。
 */
function CommandList({ open, onOpenChange, items, query, onQueryChange }: CommandListProps) {
    const groups = React.useMemo(() => {
        const m = new Map<string, typeof items>();
        for (const it of items) {
            const arr = m.get(it.group) ?? [];
            arr.push(it);
            m.set(it.group, arr);
        }
        return Array.from(m.entries());
    }, [items]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                className="overflow-hidden border-edge-hairline bg-card/80 p-0 backdrop-blur-2xl dark:bg-surface-glass/70"
            >
                <input
                    autoFocus
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    placeholder="搜索页面，或输入 > Dark 切换主题…"
                    className={cn(
                        "w-full border-b border-edge-hairline bg-transparent px-4 py-3 font-mono text-sm",
                        "placeholder:text-muted-foreground focus:outline-none",
                    )}
                />
                <div className="max-h-80 overflow-y-auto p-2">
                    {items.length === 0 ? (
                        <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                            无匹配结果
                        </p>
                    ) : null}
                    {groups.map(([group, list]) => (
                        <div key={group} className="mb-2">
                            <p className="px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                {group}
                            </p>
                            {list.map((it) => (
                                <button
                                    type="button"
                                    key={it.id}
                                    onClick={() => {
                                        it.run();
                                        onOpenChange(false);
                                    }}
                                    className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                                >
                                    {it.label}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}

export { CommandList };
