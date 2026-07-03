/**
 * CodeBlockView - 编辑器代码块自定义 NodeView
 *
 * 用 ReactNodeViewRenderer 扩展 CodeBlockLowlight，在代码块顶部加语言下拉选择。
 * - 下拉改 node.attrs.language → lowlight 自动重新高亮
 * - NodeViewContent 渲染可编辑代码区（contentEditable），保留 lowlight 实时高亮
 */
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { createLowlight } from "lowlight";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/base/select";

/** 常用语言（与 lowlight common 对齐） */
const LANGUAGES = [
    { value: "text", label: "自动/纯文本" },
    { value: "javascript", label: "JavaScript" },
    { value: "typescript", label: "TypeScript" },
    { value: "jsx", label: "JSX" },
    { value: "tsx", label: "TSX" },
    { value: "go", label: "Go" },
    { value: "rust", label: "Rust" },
    { value: "python", label: "Python" },
    { value: "java", label: "Java" },
    { value: "bash", label: "Bash / Shell" },
    { value: "json", label: "JSON" },
    { value: "yaml", label: "YAML" },
    { value: "sql", label: "SQL" },
    { value: "html", label: "HTML" },
    { value: "css", label: "CSS" },
    { value: "markdown", label: "Markdown" },
    { value: "dockerfile", label: "Dockerfile" },
    { value: "nginx", label: "Nginx" },
];

/**
 * CodeBlockView 扩展：继承 CodeBlockLowlight，加自定义 React nodeView（语言下拉）
 *
 * @param lowlight 共享的 lowlight 实例
 */
export function createCodeBlockExtension(lowlight: ReturnType<typeof createLowlight>) {
    return CodeBlockLowlight.extend({
        addNodeView() {
            return ReactNodeViewRenderer(CodeBlockViewComponent);
        },
    }).configure({ lowlight, defaultLanguage: null });
}

function CodeBlockViewComponent({ node, updateAttributes, extension }: NodeViewProps) {
    const language = (node.attrs.language as string) || "text";
    // 当前 lowlight 实例已注册的语言列表，供下拉过滤用（这里用预设列表即可）
    void extension;

    return (
        <NodeViewWrapper className="my-4 overflow-hidden rounded-lg border border-edge-hairline bg-[#24292e]">
            {/* 顶部：语言下拉 */}
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
                <Select value={language} onValueChange={(v) => updateAttributes({ language: v })}>
                    <SelectTrigger className="h-6 w-36 border-none bg-white/5 px-1 font-mono text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white focus:ring-0">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            {LANGUAGES.map((l) => (
                                <SelectItem
                                    key={l.value}
                                    value={l.value}
                                    className="focus:bg-accent focus:text-accent-foreground"
                                >
                                    {l.label}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>
            {/*
             * 可编辑代码区：NodeViewContent 透传 contentEditable。
             * CodeBlockLowlight 通过 node.attrs.language 应用 ProseMirror decoration（hljs-*），
             * language-xxx class 仅供 CSS 兜底。结构用 pre（as 仅支持 div，故用 pre 透传）。
             */}
            <NodeViewContent<"pre">
                as="pre"
                className={`!m-0 !bg-transparent overflow-x-auto p-4 text-[0.85rem] leading-6 text-[#e6edf3] ${language ? `language-${language}` : ""}`}
            />
        </NodeViewWrapper>
    );
}
