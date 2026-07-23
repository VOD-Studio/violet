/**
 * MathEditPanel - 公式编辑弹层面板（行内/块级共用）
 *
 * 弹层内容：上方源码输入区（LatexSourceField，等宽字体，行内单行 / 块级多行，
 * 内置 LaTeX 自动补全）、下方实时预览（katex-element 白名单管线，
 * 非法公式内嵌 katex-error）、底部删除入口。
 * 交互契约：Esc 关闭（补全下拉开着时 Esc 只关下拉）；行内 Enter 关闭；块级 Enter 换行。
 * 定位与开闭由 MathView 的 Popover 承载，本组件只管面板本身。
 */
import { Trash2 } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/shared/ui/base/button";
import { renderKatexElement } from "@/shared/ui/katex";
import { LatexSourceField } from "./LatexSourceField";

export interface MathEditPanelProps {
    /** 当前 LaTeX 源码（受控） */
    latex: string;
    /** true=块级（多行 textarea），false=行内（单行 input） */
    displayMode: boolean;
    /** 源码变更回调（updateAttributes 由调用方触发） */
    onChange: (latex: string) => void;
    /** Esc（行内 Enter）请求关闭弹层 */
    onClose: () => void;
    /** 删除当前公式节点；不传则不显示删除入口 */
    onDelete?: () => void;
}

/** 输入区样式：等宽、无边框聚焦感，靠弹层容器提供边界 */
const FIELD_CLASS =
    "w-full resize-none rounded-md border border-edge-hairline bg-transparent px-2 py-1.5 font-mono text-sm leading-6 outline-none focus:border-ring";

export function MathEditPanel({
    latex,
    displayMode,
    onChange,
    onClose,
    onDelete,
}: MathEditPanelProps) {
    const preview = useMemo(() => renderKatexElement(latex, displayMode), [latex, displayMode]);

    return (
        <div className="flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 sm:w-96">
            <LatexSourceField
                latex={latex}
                displayMode={displayMode}
                onChange={onChange}
                onClose={onClose}
                className={FIELD_CLASS}
            />
            {/* 实时预览：跟随正文排版（块级居中），溢出可滚动 */}
            <div
                className={`max-h-60 overflow-auto rounded-md bg-muted/50 px-3 py-2 ${
                    displayMode ? "text-center" : ""
                }`}
            >
                {preview}
            </div>
            {/* 删除入口：atom 节点选中态被弹层抢占焦点，键盘 Backspace 无法删除，
                故提供显式删除按钮。 */}
            {onDelete && (
                <div className="flex justify-end pt-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onDelete}
                        className="h-7 gap-1 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                        <Trash2 className="size-3" />
                        删除
                    </Button>
                </div>
            )}
        </div>
    );
}
