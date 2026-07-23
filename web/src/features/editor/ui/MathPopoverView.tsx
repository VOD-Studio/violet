/**
 * MathPopoverView - 公式弹层编辑视图（行内/块级共用主体）
 *
 * 弹层编辑（与 CONTEXT.md「弹层编辑」词条一致，决策见 ADR-0005）：
 * - 文档内永远只显示渲染结果（katex-element 白名单管线），点击进入 NodeSelection；
 * - 选中后弹出跟随定位的浮层（MathEditPanel：源码输入 + 实时预览），
 *   Esc/点击外部关闭，关闭后光标移到公式之后。
 *
 * Popover 开闭用独立 popoverOpen state，不直接绑定 Tiptap 的 selected prop：
 * selected 由 PM NodeSelection 驱动，但 Tiptap 的 handleSelectionUpdate 在 rAF 中
 * 重新检查 isNodeViewSelected 时，删除节点后紧接着点击下一个公式会触发竞态——
 * rAF 回调中 isNodeViewSelected 短暂返回 false，deselectNode 使 selected 抖动为
 * false（PM selection 实际仍正确选中此节点），若直接绑定 open 会导致秒开秒关。
 * selected 上升沿打开弹层；下降沿时延迟一帧确认 PM selection 确实不再选中此节点
 * 才关闭。
 *
 * 由 MathView 以 displayMode 适配出行内/块级两个 NodeView。
 */
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { useEffect, useMemo, useState } from "react";
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

    /**
     * 独立开闭 state，selected 上升沿打开；下降沿时 rAF 延迟检查 PM selection
     * 是否真的不再选中此节点——跳过 handleSelectionUpdate rAF 竞态导致的短暂
     * deselectNode（PM selection 实际仍指向此节点）。
     */
    const [popoverOpen, setPopoverOpen] = useState(false);

    useEffect(() => {
        if (selected) {
            setPopoverOpen(true);
            return;
        }
        const id = requestAnimationFrame(() => {
            // rAF 后再确认 PM selection 是否真的不再选中此节点。
            // handleSelectionUpdate 的 rAF 竞态中可能短暂 deselectNode，
            // 但此时 PM selection 实际仍覆盖此节点范围（from<=pos && to>=pos+size）。
            const sel = editor.state.selection;
            const stillSelected =
                typeof pos === "number" && sel.from <= pos && sel.to >= pos + node.nodeSize;
            if (!stillSelected) {
                setPopoverOpen(false);
            }
        });
        return () => cancelAnimationFrame(id);
    }, [selected, editor, node, pos]);

    /** Esc / 行内 Enter：关闭弹层，光标移到公式之后（NodeSelection 解除即回渲染态） */
    const close = () => {
        setPopoverOpen(false);
        if (typeof pos === "number") editor.commands.focus(pos + node.nodeSize);
    };

    /**
     * 删除当前公式节点。atom 节点选中态被弹层输入框抢占焦点，键盘无法删除，
     * 故由弹层显式触发：选中节点 → deleteSelection → 聚焦编辑器（弹层因节点卸载自动关闭）。
     */
    const handleDelete = () => {
        if (typeof pos !== "number") return;
        editor.chain().setNodeSelection(pos).deleteSelection().focus().run();
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
            open={popoverOpen && editor.isEditable}
            onOpenChange={(next) => {
                if (!next) {
                    setPopoverOpen(false);
                    // 点击外部关闭：解除 NodeSelection 即可（不抢焦点；
                    // 点在编辑器内时 PM 自己会落最终选区）
                    if (typeof pos === "number") {
                        editor.commands.setTextSelection(pos + node.nodeSize);
                    }
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
                collisionBoundary={editor.view.dom}
                updatePositionStrategy="always"
                className="border-edge-hairline w-auto p-3 shadow-lg"
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
                    onDelete={handleDelete}
                    onChange={changeLatex}
                    onClose={close}
                />
            </PopoverContent>
        </Popover>
    );
}
