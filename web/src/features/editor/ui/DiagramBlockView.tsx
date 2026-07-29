/**
 * DiagramBlockView - 图块（流程图）编辑器节点定义
 *
 * 独立 atom 节点 diagramBlock，携带 format（默认 mermaid）+ source 两个属性，
 * 打通 ```mermaid 围栏块的双向 Markdown 序列化与 slash 菜单插入。
 *
 * 1:1 参照 @tiptap/extension-mathematics 的 BlockMath（schema + markdownTokenizer +
 * parseMarkdown + renderMarkdown 四件套），但属性从 latex 换成 format + source、
 * tokenizer 正则从 $$...$$ 换成 ```mermaid fence 规则。围栏 fence 解析对齐
 * @tiptap/extension-code-block 读 token.lang 的机制。
 *
 * diagramBlock 是独立 atom（不复用 codeBlock 分流）：source 不进 contentEditable，
 * 避免 mermaid 源被自由编辑破坏语法；编辑交互走弹层（ADR-0005）。
 *
 * createDiagramBlockExtension 是装配入口（参照 createMathExtensions / createCodeBlockExtension）：
 * 在本节点定义上 .extend({ addNodeView() {...} }) 接入 DiagramPopoverView，复用数学公式
 * 已验证的浮层基础设施（@floating-ui/dom absolute + portal 进滚动容器 + Esc/外部点击关闭）。
 * 渲染核心与阅读端共用 shared/ui/diagram（renderMermaid + DOMPurify 双重防线）。
 */
import { mergeAttributes, Node } from "@tiptap/core";
import type { NodeViewProps } from "@tiptap/react";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { DiagramPopoverView } from "./DiagramPopoverView";

/**
 * mermaid 围栏块匹配正则。
 * - 起始 ``` + 可选空白 + "mermaid" + 行尾空白 + 换行
 * - 中间为 source（懒惰匹配，允许任意字符含换行）
 * - 结束为可选换行 + ```，后随换行或字符串末尾（避免吞掉闭合围栏之后的同行内容）
 *
 * 仅识别 mermaid info string；未知 info（python 等）不匹配，落回 marked 默认 fence
 * 规则产出 code token → 走 codeBlock 路径，保证不劫持。
 */
const MERMAID_FENCE_RE = /^```[ \t]*mermaid[ \t]*\n([\s\S]*?)\n?```(?=\n|$)/;

/**
 * DiagramBlock 节点：atom 块，source 不进 contentEditable。
 *
 * 节点载体 HTML：<div data-type="diagram-block" data-format="mermaid" data-source="<转义后源码>">
 * data-source 由 ProseMirror 在序列化时自动 HTML 转义，阅读端无损提取。
 */
export const DiagramBlock = Node.create({
    name: "diagramBlock",
    group: "block",
    atom: true,

    addAttributes() {
        return {
            format: {
                default: "mermaid",
                parseHTML: (element) => element.getAttribute("data-format"),
                renderHTML: (attributes) => ({ "data-format": attributes.format }),
            },
            source: {
                default: "",
                parseHTML: (element) => element.getAttribute("data-source"),
                renderHTML: (attributes) => ({ "data-source": attributes.source }),
            },
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-type="diagram-block"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ["div", mergeAttributes(HTMLAttributes, { "data-type": "diagram-block" })];
    },

    parseMarkdown: (token) => ({
        type: "diagramBlock",
        attrs: {
            format: token.lang ?? "mermaid",
            source: token.text ?? "",
        },
    }),

    renderMarkdown: (node) => {
        const format = node.attrs?.format || "mermaid";
        const source = node.attrs?.source || "";
        const lines = [`\`\`\`${format}`, source, "```"];
        return lines.join("\n");
    },

    markdownTokenizer: {
        name: "diagramBlock",
        level: "block",
        start: (src) => src.indexOf("```mermaid"),
        tokenize: (src) => {
            const match = src.match(MERMAID_FENCE_RE);
            if (!match) {
                return undefined;
            }
            const [raw, source] = match;
            return {
                type: "diagramBlock",
                raw,
                text: source,
                lang: "mermaid",
            };
        },
    },
});

/** 图块 NodeView 渲染适配器（diagramBlock 永远是块级，单一适配器即可） */
const renderDiagramView = (props: NodeViewProps) => <DiagramPopoverView {...props} />;

/**
 * createDiagramBlockExtension - 图块扩展装配工厂
 *
 * 在 DiagramBlock 节点定义上挂 React NodeView（DiagramPopoverView：文档内渲染 +
 * 弹层编辑）。schema / parseHTML / renderHTML / markdown 四件套继承自 DiagramBlock，
 * 仅追加 NodeView。参照 createMathExtensions / createCodeBlockExtension 的工厂形态。
 */
export function createDiagramBlockExtension() {
    return DiagramBlock.extend({
        addNodeView() {
            return ReactNodeViewRenderer(renderDiagramView);
        },
    });
}
