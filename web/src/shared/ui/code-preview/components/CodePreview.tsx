/**
 * 代码预览主组件（shiki）
 *
 * 功能：
 * - 语法高亮（shiki，github-dark 主题）
 * - 行号显示
 * - 横向滚动、等宽字体
 * - 复制代码
 * - 加载/错误状态 + 重试
 */

import { AlertCircle, Check, Copy, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/shared/ui/base/button";
import { useCodeHighlight } from "../hooks/useCodeHighlight";
import type { CodePreviewProps } from "../types/code-preview-types";
import { inferLanguage } from "../utils/language";

export function CodePreview({
    url,
    name,
    language,
    className,
    showLineNumbers = true,
}: CodePreviewProps) {
    const lang = language || inferLanguage(name);
    const { html, loadStatus, retry } = useCodeHighlight({ url, language: lang });
    const [copied, setCopied] = useState(false);

    async function handleCopy() {
        try {
            const res = await fetch(url);
            const text = await res.text();
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // 忽略复制失败
        }
    }

    return (
        <div
            className={`flex flex-col overflow-hidden rounded-lg border bg-[#24292e] ${className ?? ""}`}
        >
            {/* 顶部操作条 */}
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
                <span className="truncate font-mono text-xs text-white/70">{name ?? lang}</span>
                <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="text-white/70 hover:bg-white/10 hover:text-white"
                    onClick={handleCopy}
                    title="复制代码"
                >
                    {copied ? (
                        <Check className="size-3.5 text-green-400" />
                    ) : (
                        <Copy className="size-3.5" />
                    )}
                </Button>
            </div>

            {/* 代码区 */}
            <div className="max-h-[70vh] overflow-auto">
                {loadStatus === "loading" ? (
                    <div className="flex h-32 items-center justify-center">
                        <div className="size-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    </div>
                ) : loadStatus === "error" ? (
                    <div className="flex h-40 flex-col items-center justify-center gap-2 text-white/60">
                        <AlertCircle className="size-8 text-red-400" />
                        <span className="text-sm">代码加载失败</span>
                        <Button type="button" variant="outline" size="sm" onClick={retry}>
                            <RotateCcw className="mr-1.5 size-3.5" />
                            重试
                        </Button>
                    </div>
                ) : (
                    <CodeBlock html={html} showLineNumbers={showLineNumbers} />
                )}
            </div>
        </div>
    );
}

/** 渲染高亮后的代码（shiki 输出 pre>code 结构），叠加行号 */
function CodeBlock({ html, showLineNumbers }: { html: string; showLineNumbers: boolean }) {
    // 计算行数用于生成行号列
    const lineCount = (html.match(/class="line"/g) ?? []).length || 1;

    return (
        <div className="flex">
            {showLineNumbers ? (
                <div
                    className="select-none border-r border-white/10 px-3 py-3 text-right font-mono text-xs leading-relaxed text-white/30"
                    aria-hidden="true"
                >
                    {Array.from({ length: lineCount }, (_, i) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: 行号列，index 即行号，天然唯一稳定
                        <div key={`line-${i + 1}`}>{i + 1}</div>
                    ))}
                </div>
            ) : null}
            <div
                className="shiki-code flex-1 overflow-x-auto px-4 py-3 [&_pre]:!bg-transparent [&_pre]:!m-0 [&_pre]:p-0 [&_code]:!font-mono [&_code]:!text-xs [&_code]:!leading-relaxed"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: shiki 输出的 HTML 来自受信任的代码高亮，无用户输入
                dangerouslySetInnerHTML={{ __html: html }}
            />
        </div>
    );
}
