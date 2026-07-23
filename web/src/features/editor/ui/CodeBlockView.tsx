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
import { Play } from "lucide-react";
import { useState } from "react";
import { getExecResult, isTerminalStatus, submitExec } from "#/features/code-run";
import { Button } from "@/shared/ui/base/button";
// isTerminalStatus 是值（函数），与上面同属值导入
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/base/select";
import { ensureLanguageRegistered } from "../extensions";

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
 * 从 class 字符串中提取语言 id。
 *
 * 兼容远程文档/HTML 粘贴常见的多种前缀：
 * - `language-go`（highlight.js / markdown 标准）
 * - `lang-go`（部分站点简写）
 * - `hljs-go`（highlight.js 旧版输出）
 * - `brush: go` / `brush-go`（SyntaxHighlighter）
 *
 * @returns 语言 id，未匹配返回 null
 */
function extractLangFromClass(className: string | null | undefined): string | null {
    if (!className) return null;
    // brush: go（带冒号空格）
    const brushColon = className.match(/\bbrush[\s:]+([\w-]+)/i);
    if (brushColon) return brushColon[1].toLowerCase();
    // language- / lang- / hljs- / brush- 前缀
    const prefixed = className.match(/\b(?:language|lang|hljs|brush)-([\w-]+)/i);
    if (prefixed) return prefixed[1].toLowerCase();
    return null;
}

/**
 * 归一化语言 id。
 *
 * 空值、plaintext、text 统一返回 null，让 lowlight 走 highlightAuto 自动识别；
 * 其余原样返回（sh/bash、docker/dockerfile 等别名交由 lowlight 自身 alias 解析）。
 */
function normalizeLang(id: string | null): string | null {
    if (!id) return null;
    const trimmed = id.trim().toLowerCase();
    if (!trimmed || trimmed === "plaintext" || trimmed === "text") return null;
    return trimmed;
}

/**
 * 从 DOM 元素（<pre> 或其 <code> 子元素）解析代码块语言。
 *
 * 依次检查 class（多前缀）与 lang / data-language / data-lang 属性。
 * readability（go-readability）抽取掘金等站点时输出 `<code lang="go">`，
 * 故 lang 属性需显式检查，否则会被识别为纯文本。
 */
export function resolveLanguageFromElement(element: Element): string | null {
    // 候选元素：<pre> 本身 + 第一个子元素（通常是 <code>）
    const candidates: Element[] = [element];
    if (element.firstElementChild) candidates.push(element.firstElementChild);
    for (const el of candidates) {
        const fromClass = normalizeLang(extractLangFromClass(el.getAttribute("class")));
        if (fromClass) return fromClass;
        const fromAttr = normalizeLang(
            el.getAttribute("lang") ??
                el.getAttribute("data-language") ??
                el.getAttribute("data-lang"),
        );
        if (fromAttr) return fromAttr;
    }
    return null;
}

/**
 * CodeBlockView 扩展：继承 CodeBlockLowlight，加自定义 React nodeView（语言下拉）
 *
 * 同时覆盖 language 属性的 parseHTML，兼容远程导入/HTML 粘贴时多种代码块结构
 * （class 在 <pre> 或 <code>、language-/lang-/hljs-/brush: 前缀、lang / data-language 属性），
 * 避免 readability 抓取的代码块因结构差异被解析为纯文本。
 *
 * 可运行代码块：node.attrs.runnable=true 时，renderHTML 输出 data-runnable/data-lang/
 * data-overrides/data-source 属性，供阅读页 CodeRunner 识别挂载（见 shared/ui/code-runner）。
 *
 * @param lowlight 共享的 lowlight 实例
 */
export function createCodeBlockExtension(lowlight: ReturnType<typeof createLowlight>) {
    return CodeBlockLowlight.extend({
        addNodeView() {
            return ReactNodeViewRenderer(CodeBlockViewComponent);
        },
        addAttributes() {
            return {
                ...this.parent?.(),
                language: {
                    default: null,
                    parseHTML: (element: HTMLElement) => resolveLanguageFromElement(element),
                },
                // 可运行标记：true 时该代码块在阅读页渲染为 CodeRunner
                runnable: {
                    default: false,
                    parseHTML: (element: HTMLElement) =>
                        element.getAttribute("data-runnable") === "true",
                    renderHTML: (attributes: { runnable?: boolean }) =>
                        attributes.runnable ? { "data-runnable": "true" } : {},
                },
                // 资源覆盖 JSON（作者声明的 timeout/memory/network 等）
                overrides: {
                    default: null,
                    parseHTML: (element: HTMLElement) =>
                        element.getAttribute("data-overrides") || null,
                    renderHTML: (attributes: { overrides?: string | null }) =>
                        attributes.overrides ? { "data-overrides": attributes.overrides } : {},
                },
            };
        },
        // renderHTML：runnable 块输出 data-* 属性 + data-source（HTML 转义源码）供阅读页无损提取
        renderHTML({
            node,
            HTMLAttributes,
        }: {
            node: {
                attrs: { language?: string | null; runnable?: boolean; overrides?: string | null };
                textOf?: () => string;
            };
            HTMLAttributes: Record<string, unknown>;
        }) {
            const isRunnable = node.attrs.runnable === true;
            if (!isRunnable) {
                // 普通代码块走父类默认渲染（<pre><code class="language-xxx">）
                return [
                    "pre",
                    HTMLAttributes,
                    [
                        "code",
                        { class: node.attrs.language ? `language-${node.attrs.language}` : null },
                        0,
                    ],
                ] as const;
            }
            // 可运行块：输出 data-* 属性，data-source 由阅读页从 code 子节点取（避免双重存储）
            const lang = node.attrs.language || "";
            const extraAttrs: Record<string, string> = {
                "data-runnable": "true",
                "data-lang": lang,
            };
            if (node.attrs.overrides) extraAttrs["data-overrides"] = node.attrs.overrides;
            return [
                "pre",
                { ...HTMLAttributes, ...extraAttrs },
                ["code", { class: lang ? `language-${lang}` : null }, 0],
            ] as const;
        },
    }).configure({ lowlight, defaultLanguage: null });
}

function CodeBlockViewComponent({ node, updateAttributes, extension }: NodeViewProps) {
    const language = (node.attrs.language as string) || "text";
    const isRunnable = node.attrs.runnable === true;
    const overridesJson = (node.attrs.overrides as string | null) || undefined;
    // common 预设外的语言首次选中需动态注册语法，期间禁用下拉避免重复触发
    const [registering, setRegistering] = useState(false);
    // 运行状态：idle / running / 结果文本
    const [runState, setRunState] = useState<"idle" | "running">("idle");
    const [resultText, setResultText] = useState<string | null>(null);
    void extension;

    const handleLanguageChange = async (v: string) => {
        setRegistering(true);
        await ensureLanguageRegistered(v);
        setRegistering(false);
        // updateAttributes 产生 docChanged 事务，LowlightPlugin 据此重算高亮装饰
        updateAttributes({ language: v });
    };

    // 编辑器内运行：轮询路径（submitExec 拿 task_id → 轮询 getExecResult）
    // 对应 yggdrasil make_run_code_closure 的轮询逻辑。
    const handleRun = async () => {
        // 从 node 取纯文本源码（contentEditable 内容）
        const source = node.textContent || "";
        setRunState("running");
        setResultText(null);
        try {
            const overrides = overridesJson ? JSON.parse(overridesJson) : undefined;
            const taskId = await submitExec({ language, source, overrides });
            // 轮询直到终态
            const maxAttempts = 120; // 最长 ~60s
            for (let i = 0; i < maxAttempts; i++) {
                await new Promise((r) => setTimeout(r, 500));
                const task = await getExecResult(taskId);
                if (isTerminalStatus(task.status)) {
                    const parts = [
                        task.exit_code != null ? `退出码 ${task.exit_code}` : "",
                        task.duration_ms > 0 ? `${task.duration_ms}ms` : "",
                    ]
                        .filter(Boolean)
                        .join(" · ");
                    const out = [
                        task.stdout ? `stdout:\n${task.stdout}` : "",
                        task.stderr ? `stderr:\n${task.stderr}` : "",
                        parts ? `[${task.status} · ${parts}]` : `[${task.status}]`,
                    ]
                        .filter(Boolean)
                        .join("\n\n");
                    setResultText(out || `[${task.status}]`);
                    setRunState("idle");
                    return;
                }
            }
            setResultText("[轮询超时]");
            setRunState("idle");
        } catch (err) {
            setResultText(`运行失败：${err instanceof Error ? err.message : String(err)}`);
            setRunState("idle");
        }
    };

    return (
        <NodeViewWrapper className="my-4 overflow-hidden rounded-lg border border-edge-hairline bg-[#24292e]">
            {/* 顶部：语言下拉 + （runnable 时）运行按钮 */}
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
                <Select
                    value={language}
                    disabled={registering}
                    onValueChange={handleLanguageChange}
                >
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
                {isRunnable && (
                    <Button
                        type="button"
                        size="xs"
                        variant={runState === "running" ? "secondary" : "default"}
                        onClick={handleRun}
                        disabled={runState === "running"}
                        className="gap-1"
                    >
                        <Play className="size-3" />
                        {runState === "running" ? "运行中…" : "运行"}
                    </Button>
                )}
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
            {/* 运行结果区（仅 runnable 且有结果时显示） */}
            {isRunnable && resultText && (
                <pre className="code-block-scrollbar max-h-48 overflow-auto border-t border-white/10 bg-black/30 p-3 text-xs leading-relaxed text-white/90">
                    <code>{resultText}</code>
                </pre>
            )}
        </NodeViewWrapper>
    );
}
