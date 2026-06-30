/**
 * SlashMenu - 斜杠命令菜单的 React 视图
 *
 * 由 ReactRenderer 挂载，接收 SuggestionProps（items/query/command）。
 * 支持上下键导航 + 回车选中 + 点击选中，按 query 过滤。
 */
import type { Editor } from "@tiptap/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SlashMenuItem } from "./slash-items";

export interface SlashMenuProps {
    /** 已过滤后的菜单项 */
    items: SlashMenuItem[];
    /** 当前查询字符串 */
    query: string;
    /** 选中某项的回调（由 suggestion 提供的 command） */
    command: (item: SlashMenuItem) => void;
    /** 编辑器实例 */
    editor: Editor;
}

export function SlashMenuView({ items, command }: SlashMenuProps) {
    const [selected, setSelected] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    // items 变化（输入过滤）时重置选中项为首项
    // biome-ignore lint/correctness/useExhaustiveDependencies: items 仅作触发器
    useEffect(() => {
        setSelected(0);
    }, [items]);

    // 由父级 ReactRenderer 通过 ref 调用：处理键盘事件
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelected((s) => (s + 1) % Math.max(items.length, 1));
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelected((s) => (s - 1 + items.length) % Math.max(items.length, 1));
            } else if (e.key === "Enter") {
                e.preventDefault();
                const item = items[selected];
                if (item) command(item);
            }
        };
        window.addEventListener("keydown", handler, true);
        return () => window.removeEventListener("keydown", handler, true);
    }, [items, selected, command]);

    // 滚动选中项到可视区
    useEffect(() => {
        const el = listRef.current?.querySelector(`[data-idx="${selected}"]`);
        el?.scrollIntoView({ block: "nearest" });
    }, [selected]);

    const groups = useMemo(() => {
        const m = new Map<string, SlashMenuItem[]>();
        for (const it of items) {
            const arr = m.get(it.group) ?? [];
            arr.push(it);
            m.set(it.group, arr);
        }
        return Array.from(m.entries());
    }, [items]);

    // 计算全局索引（跨分组）
    let flatIdx = -1;

    if (items.length === 0) {
        return (
            <div className="w-60 rounded-lg border border-edge-hairline bg-popover p-3 text-sm text-muted-foreground shadow-lg">
                无匹配结果
            </div>
        );
    }

    return (
        <div
            ref={listRef}
            className="max-h-72 w-72 overflow-y-auto rounded-lg border border-edge-hairline bg-popover p-1.5 shadow-xl"
        >
            {groups.map(([group, list]) => (
                <div key={group} className="mb-1">
                    <p className="px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {group}
                    </p>
                    {list.map((item) => {
                        flatIdx += 1;
                        const idx = flatIdx;
                        const Icon = item.icon;
                        return (
                            <button
                                type="button"
                                key={item.id}
                                data-idx={idx}
                                onMouseEnter={() => setSelected(idx)}
                                onClick={() => command(item)}
                                className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors ${
                                    idx === selected ? "bg-accent" : "hover:bg-accent/50"
                                }`}
                            >
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-edge-hairline bg-background">
                                    <Icon className="size-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium">
                                        {item.title}
                                    </span>
                                    <span className="block truncate text-xs text-muted-foreground">
                                        {item.description}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
