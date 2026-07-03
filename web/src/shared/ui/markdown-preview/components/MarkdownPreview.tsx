/**
 * Markdown 预览主组件（react-markdown + remark-gfm）
 *
 * 功能：
 * - GFM 渲染（表格/任务列表/删除线/自动链接）
 * - 内联元素样式映射（不依赖 prose 插件）
 * - 复制源码
 * - 加载/错误状态 + 重试
 */

import { AlertCircle, Check, Copy, RotateCcw } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/shared/ui/base/button";
import { copyText } from "@/shared/lib/clipboard";
import { useMarkdown } from "../hooks/useMarkdown";
import type { MarkdownPreviewProps } from "../types/markdown-preview-types";
import { markdownComponents } from "./markdown-components";

export function MarkdownPreview({ url, name, className }: MarkdownPreviewProps) {
    const { source, loadStatus, retry } = useMarkdown({ url });
    const [copied, setCopied] = useState(false);

    async function handleCopy() {
        const ok = await copyText(source);
        if (ok) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }

    return (
        <div
            className={`flex flex-col overflow-hidden rounded-lg border bg-background ${className ?? ""}`}
        >
            {/* 顶部操作条 */}
            <div className="flex items-center justify-between border-b px-3 py-1.5">
                <span className="truncate text-xs text-muted-foreground">
                    {name ?? "Markdown 文档"}
                </span>
                <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={handleCopy}
                    disabled={loadStatus !== "ready"}
                    title="复制源码"
                >
                    {copied ? (
                        <Check className="size-3.5 text-green-500" />
                    ) : (
                        <Copy className="size-3.5" />
                    )}
                </Button>
            </div>

            {/* 内容区 */}
            <div className="max-h-[70vh] overflow-auto px-5 py-4">
                {loadStatus === "loading" ? (
                    <div className="flex h-32 items-center justify-center">
                        <div className="size-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
                    </div>
                ) : loadStatus === "error" ? (
                    <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                        <AlertCircle className="size-8 text-red-500" />
                        <span className="text-sm">Markdown 加载失败</span>
                        <Button type="button" variant="outline" size="sm" onClick={retry}>
                            <RotateCcw className="mr-1.5 size-3.5" />
                            重试
                        </Button>
                    </div>
                ) : (
                    <article className="text-sm">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                            {source}
                        </ReactMarkdown>
                    </article>
                )}
            </div>
        </div>
    );
}
