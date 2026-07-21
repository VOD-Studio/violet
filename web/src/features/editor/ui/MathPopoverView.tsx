/**
 * MathPopoverView - 公式弹层编辑视图（行内/块级共用主体）
 *
 * 弹层编辑（与 CONTEXT.md「弹层编辑」词条一致，决策见 ADR-0005）：
 * - 文档内永远只显示渲染结果（katex-element 白名单管线），点击进入 NodeSelection；
 * - 选中后弹出跟随定位的浮层（MathEditPanel：源码输入 + 实时预览），
 *   Esc/点击外部关闭，关闭后光标移到公式之后。
 *
 * 由 MathView 以 displayMode 适配出行内/块级两个 NodeView。
 */
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { useMemo } from "react";
import { Popover, PopoverContent } from "@/shared/ui/base/popover";
import { renderKatexElement } from "@/shared/ui/katex";
import { useMathAnchor } from "../hooks/useMathAnchor";
import { updateMathLatex } from "../lib/update-math-latex";
import { MathEditPanel } from "./MathEditPanel";
import "katex/dist/katex.min.css";

export interface MathPopoverViewProps extends NodeViewProps {
    /** true=公式块（div + 多行输入），false=行内公式（span + 单行输入） */
    displayMode: boolean;
}

export function MathPopoverView({
    node,
    selected,
    editor,
    getPos,
    displayMode,
}: MathPopoverViewProps) {
    const latex = node.attrs.latex as string;
    const rendered = useMemo(() => renderKatexElement(latex, displayMode), [latex, displayMode]);
    const anchorRef = useMathAnchor(getPos, editor);
    const pos = typeof getPos === "function" ? getPos() : null;

    /** Esc / 行内 Enter：关闭弹层，光标移到公式之后（NodeSelection 解除即回渲染态） */
    const close = () => {
        if (typeof pos === "number") editor.commands.focus(pos + node.nodeSize);
    };

    /**
     * 源码变更：走 updateMathLatex 而非 updateAttributes——
     * 裸 setNodeMarkup 会让行内节点的 NodeSelection 降级，弹层一输入就关闭
     */
    const changeLatex = (v: string) => {
        editor.commands.command(({ tr }) => {
            const p = typeof getPos === "function" ? getPos() : null;
            if (typeof p !== "number") return false;
            updateMathLatex(tr, p, v);
            return true;
        });
    };

    return (
        <Popover
            open={selected && editor.isEditable}
            onOpenChange={(next) => {
                // 点击外部关闭：解除 NodeSelection 即可（不抢焦点；
                // 点在编辑器内时 PM 自己会落最终选区）
                if (!next && selected && typeof pos === "number") {
                    editor.commands.setTextSelection(pos + node.nodeSize);
                }
            }}
        >
            <PopoverPrimitive.Anchor virtualRef={anchorRef} />
            <NodeViewWrapper
                as={displayMode ? "div" : "span"}
                data-type={displayMode ? "block-math" : "inline-math"}
                className={
                    displayMode
                        ? `math-node-view math-node-view--block${selected ? " math-node-view--selected" : ""}`
                        : `math-node-view${selected ? " math-node-view--selected" : ""}`
                }
                onClick={() => {
                    if (typeof pos === "number") editor.chain().setNodeSelection(pos).run();
                }}
            >
                {rendered}
            </NodeViewWrapper>
            <PopoverContent
                side="bottom"
                sideOffset={6}
                collisionPadding={12}
                updatePositionStrategy="always"
                className="w-auto p-3"
                onOpenAutoFocus={(e) => {
                    // 聚焦源码输入区而非弹层容器
                    e.preventDefault();
                    const content = e.currentTarget as HTMLElement | null;
                    content?.querySelector<HTMLElement>("input,textarea")?.focus();
                }}
            >
                <MathEditPanel
                    latex={latex}
                    displayMode={displayMode}
                    onChange={changeLatex}
                    onClose={close}
                />
            </PopoverContent>
        </Popover>
    );
}
