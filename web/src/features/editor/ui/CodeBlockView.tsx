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

/**
 * 代码块语言下拉选项。
 *
 * 覆盖 lowlight common 预设的全部语言 + 常用扩展项（dockerfile/nginx/vue/powershell 等）。
 * common 预设外的语言编辑时不实时高亮，由 extensions 的 ensureLanguageRegistered 按需注册；
 * 保存后前台展示统一走 shiki bundle/full 兜底。
 */
const LANGUAGES = [
    { value: "text", label: "自动/纯文本" },
    { value: "plaintext", label: "纯文本" },
    // —— Web / 前端 ——
    { value: "html", label: "HTML" },
    { value: "css", label: "CSS" },
    { value: "scss", label: "SCSS" },
    { value: "less", label: "Less" },
    { value: "javascript", label: "JavaScript" },
    { value: "typescript", label: "TypeScript" },
    { value: "jsx", label: "JSX" },
    { value: "tsx", label: "TSX" },
    { value: "vue", label: "Vue" },
    { value: "json", label: "JSON" },
    { value: "yaml", label: "YAML" },
    { value: "markdown", label: "Markdown" },
    // —— 系统 / 脚本 / 配置 ——
    { value: "bash", label: "Bash / Shell" },
    { value: "shell", label: "Shell Session" },
    { value: "powershell", label: "PowerShell" },
    { value: "dockerfile", label: "Dockerfile" },
    { value: "nginx", label: "Nginx" },
    { value: "makefile", label: "Makefile" },
    { value: "ini", label: "INI / TOML" },
    { value: "diff", label: "Diff" },
    // —— 后端 / 编译型 ——
    { value: "go", label: "Go" },
    { value: "rust", label: "Rust" },
    { value: "python", label: "Python" },
    { value: "java", label: "Java" },
    { value: "kotlin", label: "Kotlin" },
    { value: "swift", label: "Swift" },
    { value: "ruby", label: "Ruby" },
    { value: "php", label: "PHP" },
    { value: "c", label: "C" },
    { value: "cpp", label: "C++" },
    { value: "csharp", label: "C#" },
    { value: "objectivec", label: "Objective-C" },
    { value: "lua", label: "Lua" },
    { value: "r", label: "R" },
    { value: "perl", label: "Perl" },
    { value: "graphql", label: "GraphQL" },
    { value: "sql", label: "SQL" },
    // —— 标记 / 其它 ——
    { value: "xml", label: "XML" },
    { value: "arduino", label: "Arduino" },
    { value: "wasm", label: "WebAssembly" },
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
                className={`m-0! bg-transparent! overflow-x-auto p-4 text-[0.85rem] leading-6 text-[#e6edf3] ${language ? `language-${language}` : ""}`}
            />
        </NodeViewWrapper>
    );
}
