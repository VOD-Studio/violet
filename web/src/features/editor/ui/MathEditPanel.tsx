/**
 * MathEditPanel - 公式编辑弹层面板（行内/块级共用）
 *
 * 弹层内容：上方源码输入区（等宽字体，行内单行 input / 块级多行 textarea）、
 * 下方实时预览（katex-element 白名单管线，非法公式内嵌 katex-error）。
 * 交互契约：Esc 关闭；行内 Enter 关闭；块级 Enter 换行。
 * 定位与开闭由 MathView 的 Popover 承载，本组件只管面板本身。
 */
import { useMemo } from "react";
import { renderKatexElement } from "@/shared/ui/katex";

export interface MathEditPanelProps {
    /** 当前 LaTeX 源码（受控） */
    latex: string;
    /** true=块级（多行 textarea），false=行内（单行 input） */
    displayMode: boolean;
    onChange: (latex: string) => void;
    /** Esc（行内 Enter）请求关闭弹层 */
    onClose: () => void;
}

/** 输入区共有样式：等宽、无边框聚焦感，靠弹层容器提供边界 */
const FIELD_CLASS =
    "w-full resize-none rounded-md border border-edge-hairline bg-transparent px-2 py-1.5 font-mono text-sm leading-6 outline-none focus:border-ring";

export function MathEditPanel({ latex, displayMode, onChange, onClose }: MathEditPanelProps) {
    const preview = useMemo(() => renderKatexElement(latex, displayMode), [latex, displayMode]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape" || (!displayMode && e.key === "Enter")) {
            e.preventDefault();
            onClose();
        }
    };

    return (
        <div className="flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 sm:w-96">
            {displayMode ? (
                <textarea
                    className={FIELD_CLASS}
                    value={latex}
                    spellCheck={false}
                    rows={Math.min(8, Math.max(2, latex.split("\n").length))}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
            ) : (
                <input
                    className={FIELD_CLASS}
                    value={latex}
                    spellCheck={false}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
            )}
            {/* 实时预览：跟随正文排版（块级居中），溢出可滚动 */}
            <div
                className={`max-h-60 overflow-auto rounded-md bg-muted/50 px-3 py-2 ${
                    displayMode ? "text-center" : ""
                }`}
            >
                {preview}
            </div>
        </div>
    );
}
