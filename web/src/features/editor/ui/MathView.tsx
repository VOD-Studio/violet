/**
 * MathView - 数学公式双态编辑 NodeView
 *
 * 双态模型（与 CONTEXT.md「双态编辑」词条一致）：
 * - 未选中：KaTeX 渲染结果，点击进入选中（NodeSelection）；
 * - 选中：源码输入框 + 实时预览（块级上源码下预览，行内紧凑同行），Esc/Enter 退出。
 *
 * 官方扩展只暴露 onClick 钩子、无内置编辑 UI，故覆写 addNodeView。
 * 宏表与渲染核心走 shared/ui/katex，与阅读端同源。
 */
import { BlockMath, InlineMath } from "@tiptap/extension-mathematics";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { useMemo } from "react";
import { KATEX_OPTIONS, renderKatex } from "@/shared/ui/katex";
import "katex/dist/katex.min.css";

function InlineMathViewComponent({
    node,
    updateAttributes,
    selected,
    editor,
    getPos,
}: NodeViewProps) {
    const latex = node.attrs.latex as string;
    const html = useMemo(() => renderKatex(latex, false), [latex]);
    const pos = typeof getPos === "function" ? getPos() : null;

    if (!editor.isEditable || !selected) {
        return (
            <NodeViewWrapper
                as="span"
                data-type="inline-math"
                className="math-node-view"
                onClick={() => {
                    if (typeof pos === "number") editor.chain().setNodeSelection(pos).run();
                }}
            >
                <span dangerouslySetInnerHTML={{ __html: html }} />
            </NodeViewWrapper>
        );
    }

    return (
        <NodeViewWrapper
            as="span"
            data-type="inline-math"
            className="math-node-view math-node-view--editing"
        >
            <input
                className="math-source-input"
                value={latex}
                autoFocus
                spellCheck={false}
                onChange={(e) => updateAttributes({ latex: e.target.value })}
                onKeyDown={(e) => {
                    if ((e.key === "Escape" || e.key === "Enter") && typeof pos === "number") {
                        e.preventDefault();
                        // 光标移到节点之后：NodeSelection 解除即回渲染态
                        editor.commands.focus(pos + node.nodeSize);
                    }
                }}
            />
            <span className="math-live-preview" dangerouslySetInnerHTML={{ __html: html }} />
        </NodeViewWrapper>
    );
}

function BlockMathViewComponent({
    node,
    updateAttributes,
    selected,
    editor,
    getPos,
}: NodeViewProps) {
    const latex = node.attrs.latex as string;
    const html = useMemo(() => renderKatex(latex, true), [latex]);
    const pos = typeof getPos === "function" ? getPos() : null;

    if (!editor.isEditable || !selected) {
        return (
            <NodeViewWrapper
                data-type="block-math"
                className="math-node-view math-node-view--block"
                onClick={() => {
                    if (typeof pos === "number") editor.chain().setNodeSelection(pos).run();
                }}
            >
                <div dangerouslySetInnerHTML={{ __html: html }} />
            </NodeViewWrapper>
        );
    }

    return (
        <NodeViewWrapper
            data-type="block-math"
            className="math-node-view math-node-view--block math-node-view--editing"
        >
            <textarea
                className="math-source-textarea"
                value={latex}
                autoFocus
                spellCheck={false}
                rows={Math.min(8, Math.max(2, latex.split("\n").length))}
                onChange={(e) => updateAttributes({ latex: e.target.value })}
                onKeyDown={(e) => {
                    if (e.key === "Escape" && typeof pos === "number") {
                        e.preventDefault();
                        editor.commands.focus(pos + node.nodeSize);
                    }
                }}
            />
            <div className="math-live-preview" dangerouslySetInnerHTML={{ __html: html }} />
        </NodeViewWrapper>
    );
}

/**
 * createMathExtensions - 数学公式扩展对（覆写官方 NodeView 为双态编辑）
 *
 * KATEX_OPTIONS 与阅读端共享宏表；输入规则（$ / $$ 自动转换）由官方扩展自带。
 */
export function createMathExtensions() {
    return [
        InlineMath.extend({
            addNodeView() {
                return ReactNodeViewRenderer(InlineMathViewComponent);
            },
        }).configure({ katexOptions: KATEX_OPTIONS }),
        BlockMath.extend({
            addNodeView() {
                return ReactNodeViewRenderer(BlockMathViewComponent);
            },
        }).configure({ katexOptions: KATEX_OPTIONS }),
    ];
}
