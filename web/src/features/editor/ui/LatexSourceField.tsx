/**
 * LatexSourceField - LaTeX 源码输入框（带自动补全）
 *
 * 输入 `\` 触发建议下拉（候选来自 latex-commands 清单），
 * ↑↓ 导航、Enter/Tab 接受、Esc 仅关闭下拉（再按才冒泡给弹层 onClose）。
 * 接受后替换 `\query` 为模板，光标落在第一个占位符内。
 * 行内单行 input / 块级多行 textarea 由 displayMode 决定。
 */
import { useLayoutEffect, useRef, useState } from "react";
import {
    applyCompletion,
    extractQuery,
    filterCommands,
    type LatexQuery,
} from "../lib/latex-autocomplete";
import type { LatexCommand } from "../lib/latex-commands";
import { LatexSuggestionList } from "./LatexSuggestionList";

export interface LatexSourceFieldProps {
    /** 当前 LaTeX 源码（受控） */
    latex: string;
    /** true=多行 textarea（块级），false=单行 input（行内） */
    displayMode: boolean;
    /** 源码变更回调（含补全接受后的替换结果） */
    onChange: (latex: string) => void;
    /** Esc（下拉已关闭时）/ 行内 Enter 请求关闭弹层 */
    onClose: () => void;
    /** 输入框附加样式（等宽、边框等由调用方给） */
    className?: string;
}

export function LatexSourceField({
    latex,
    displayMode,
    onChange,
    onClose,
    className,
}: LatexSourceFieldProps) {
    const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
    /** 最近一次已知光标位置（onChange/onSelect 同步） */
    const [cursorPos, setCursorPos] = useState(latex.length);
    /** 光标处查询（null=不在命令上下文，不显示下拉） */
    const [query, setQuery] = useState<LatexQuery | null>(null);
    /** Esc 关闭下拉后置位，查询变化前不再自动弹出 */
    const [dismissed, setDismissed] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    /** 接受补全后待恢复的光标位置（等父级回写 latex 再落 selection） */
    const pendingCursor = useRef<number | null>(null);

    const candidates = query && !dismissed ? filterCommands(query.text) : [];
    const open = candidates.length > 0;
    const active = Math.min(activeIndex, candidates.length - 1);

    /** 从 DOM 同步光标并重算查询 */
    const syncCursor = (el: HTMLInputElement | HTMLTextAreaElement) => {
        const pos = el.selectionStart ?? el.value.length;
        setCursorPos(pos);
        setQuery(extractQuery(el.value, pos));
        setDismissed(false);
    };

    const accept = (cmd: LatexCommand) => {
        if (!query) return;
        const { value, cursor } = applyCompletion(latex, cursorPos, query.start, cmd.template);
        pendingCursor.current = cursor;
        setQuery(null);
        setActiveIndex(0);
        onChange(value);
    };

    // 父级回写 latex 后恢复光标（updateAttributes 经 PM 事务异步回写）
    // biome-ignore lint/correctness/useExhaustiveDependencies: latex 仅作触发器，函数体只读写 ref
    useLayoutEffect(() => {
        if (pendingCursor.current != null && fieldRef.current) {
            fieldRef.current.setSelectionRange(pendingCursor.current, pendingCursor.current);
            pendingCursor.current = null;
        }
    }, [latex]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (open) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((active + 1) % candidates.length);
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((active - 1 + candidates.length) % candidates.length);
                return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                const cmd = candidates[active];
                if (cmd) accept(cmd);
                return;
            }
            if (e.key === "Escape") {
                // 下拉开着时 Esc 只关下拉，不关闭整个弹层
                e.preventDefault();
                setDismissed(true);
                setQuery(null);
                return;
            }
        }
        if (e.key === "Escape" || (!displayMode && e.key === "Enter")) {
            e.preventDefault();
            onClose();
        }
    };

    const sharedProps = {
        ref: fieldRef as React.Ref<HTMLInputElement & HTMLTextAreaElement>,
        className,
        value: latex,
        spellCheck: false,
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            onChange(e.target.value);
            syncCursor(e.target);
        },
        onSelect: (e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            syncCursor(e.currentTarget),
        onKeyDown: handleKeyDown,
    };

    return (
        <div className="flex flex-col gap-1">
            {displayMode ? (
                <textarea
                    {...sharedProps}
                    rows={Math.min(8, Math.max(2, latex.split("\n").length))}
                />
            ) : (
                <input {...sharedProps} />
            )}
            {open && (
                <LatexSuggestionList
                    candidates={candidates}
                    activeIndex={active}
                    onSelect={accept}
                />
            )}
        </div>
    );
}
