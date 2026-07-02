/**
 * CodeBlock - 前台代码块组件（shiki 高亮 + 语言标签 + 复制）
 *
 * 供 markdownComponents.code 使用：
 * - 围栏代码块（``` lang）：shiki 高亮，顶部语言标签 + 复制按钮
 * - 行内代码（`code`）：纯样式，不高亮
 *
 * 区分依据：react-markdown 对围栏代码块传 className="language-xxx"，
 * 行内代码无 className。
 */
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useShikiHighlight } from "@/shared/ui/code-preview/use-shiki-highlight";

interface CodeBlockProps {
    /** react-markdown 传入的 className，如 "language-typescript" */
    className?: string;
    /** 代码内容 */
    children?: React.ReactNode;
}

/**
 * nodeToText - 把 react-markdown 传入的 React 节点递归提取为纯文本
 *
 * react-markdown 对围栏代码块传的 children 是 React 元素数组（非字符串），
 * 直接 String() 会得到 "[object Object]"，需递归取 props.children / 字符串叶子。
 */
function nodeToText(node: React.ReactNode): string {
    if (node == null || typeof node === "boolean") return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(nodeToText).join("");
    if (typeof node === "object" && "props" in node) {
        const props = (node as React.ReactElement<{ children?: React.ReactNode }>).props;
        return nodeToText(props.children);
    }
    return "";
}

export function CodeBlock({ className, children }: CodeBlockProps) {
    const match = /language-(\S+)/.exec(className || "");
    const language = match?.[1] ?? "";
    // 提取纯文本代码内容（react-markdown 传的是节点，非字符串）
    const code = nodeToText(children).replace(/\n$/, "");
    // 围栏代码块判定：有 language class，或内容跨行（pre/code 结构、历史无 class 数据）
    const isFenced = !!match || code.includes("\n");

    if (!isFenced) {
        // 行内代码：纯样式
        return (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-primary">
                {children}
            </code>
        );
    }

    return <FencedCodeBlock code={code} language={language} />;
}

/** 围栏代码块：shiki 高亮 + 语言标签 + 复制按钮 */
function FencedCodeBlock({ code, language }: { code: string; language: string }) {
    const { html, loading } = useShikiHighlight(code, language);
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            /* 复制失败忽略 */
        }
    };

    return (
        <div className="group relative my-6 overflow-hidden rounded-lg border border-edge-hairline bg-[#24292e]">
            {/* 顶部：语言标签 + 复制按钮 */}
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
                <span className="font-mono text-xs text-white/70">{language || "text"}</span>
                <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                    title="复制代码"
                >
                    {copied ? (
                        <Check className="size-3.5 text-green-400" />
                    ) : (
                        <Copy className="size-3.5" />
                    )}
                    {copied ? "已复制" : "复制"}
                </button>
            </div>
            {/* 代码区：shiki 输出 <pre><code>，直接渲染 */}
            {loading ? (
                <div className="flex h-24 items-center justify-center">
                    <div className="size-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                </div>
            ) : html ? (
                <div
                    className="shiki-code overflow-x-auto px-4 py-3 text-sm leading-relaxed [&_pre]:!m-0 [&_pre]:!bg-transparent [&_pre]:!p-0 [&_code]:!font-mono [&_code]:!text-sm"
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: shiki 本地高亮输出，非用户直接输入
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            ) : (
                // 高亮失败降级：纯文本
                <pre className="overflow-x-auto px-4 py-3 text-sm leading-relaxed text-white/90">
                    <code>{code}</code>
                </pre>
            )}
        </div>
    );
}
