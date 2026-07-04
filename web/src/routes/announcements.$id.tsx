/**
 * /announcements/$id - 公告事件简报（article 形态）
 *
 * 渲染为「事件简报（Event Manifest）」而非文章详情页。核心区别：
 * 无封面大图、无 H1、无 TOC、无作者头像组、无浏览量——这些是文章专属耦合。
 *
 * 视觉分层（见 CONTEXT.md「事件简报」）：
 * - 整页底层 FaultyTerminal 故障终端背景
 * - manifest 容器外框 ElectricBorder
 * - 头部 [SEVERITY] #id 用 ShinyText + 标题 DecryptedText
 * - timeline 用 AnimatedList 逐行展示 opened/window/status
 * - 正文 ArticleContent（纯渲染器）套 mono 区块
 * - footer acknowledge/copy id/back，acknowledge 用 ClickSpark
 */

import { useAnnouncement } from "@features/settings/api/queries";
import ArticleContent from "@shared/ui/markdown-preview/ArticleContent";
import AnimatedList from "@shared/vendor/react-bits/AnimatedList/AnimatedList";
import ClickSpark from "@shared/vendor/react-bits/ClickSpark/ClickSpark";
import DecryptedText from "@shared/vendor/react-bits/DecryptedText";
import ElectricBorder from "@shared/vendor/react-bits/ElectricBorder/ElectricBorder";
import FaultyTerminal from "@shared/vendor/react-bits/FaultyTerminal/FaultyTerminal";
import ShinyText from "@shared/vendor/react-bits/ShinyText/ShinyText";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Copy } from "lucide-react";
import { useState } from "react";

const SEVERITY_COLOR: Record<string, string> = {
    info: "#3b82f6",
    warning: "#f59e0b",
    success: "#10b981",
    error: "#ef4444",
};

function ManifestPage() {
    const { id } = Route.useParams();
    const { data: a, isLoading, error } = useAnnouncement(id);
    const [copied, setCopied] = useState(false);

    if (isLoading) {
        return (
            <div className="container mx-auto px-6 py-32">
                <div className="mx-auto h-64 max-w-2xl animate-pulse rounded-lg bg-muted" />
            </div>
        );
    }

    if (error || !a) {
        return (
            <div className="container mx-auto flex flex-col items-center px-6 py-32 text-center">
                <h1 className="mb-3 font-mono text-2xl font-bold">公告不存在</h1>
                <p className="mb-6 text-muted-foreground">该公告可能不存在或已失效。</p>
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 rounded-lg border border-edge-hairline px-4 py-2 text-sm transition-colors hover:bg-accent"
                >
                    <ArrowLeft className="size-4" />
                    返回首页
                </Link>
            </div>
        );
    }

    const color = SEVERITY_COLOR[a.severity] ?? SEVERITY_COLOR.info;
    const stamp = a.created_at
        ? new Date(a.created_at).toISOString().replace("T", " ").slice(0, 16)
        : "—";
    const window =
        a.start_time || a.end_time
            ? `${a.start_time ? new Date(a.start_time).toISOString().slice(0, 16) : "—"} → ${a.end_time ? new Date(a.end_time).toISOString().slice(0, 16) : "—"}`
            : "no time window";
    const body = a.content_html?.trim() ? a.content_html : a.content_md;

    const handleCopyId = async () => {
        try {
            await navigator.clipboard.writeText(String(a.id));
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            /* clipboard 不可用时静默 */
        }
    };

    const timelineItems = [
        `opened   ${stamp}`,
        `window   ${window}`,
        `status   ${a.is_active === false ? "INACTIVE" : "ACTIVE"}`,
    ];

    return (
        <div className="relative min-h-screen">
            {/* 底层故障终端背景 */}
            <div className="pointer-events-none fixed inset-0 z-0 opacity-20">
                <FaultyTerminal />
            </div>

            <div className="container relative z-10 mx-auto px-6 py-16">
                <Link
                    to="/"
                    className="mb-8 inline-flex items-center gap-1.5 font-mono text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                    <ArrowLeft className="size-4" />
                    back
                </Link>

                <div className="mx-auto max-w-2xl">
                    <ElectricBorder color={color} speed={1.2} chaos={0.08} borderRadius={8}>
                        <article className="bg-card/95 p-8 font-mono backdrop-blur-sm">
                            {/* 头部 */}
                            <header className="mb-6 border-b border-edge-hairline pb-4">
                                <div className="mb-3 flex items-center justify-between">
                                    <ShinyText
                                        text={`[${a.severity.toUpperCase()}] #${String(a.id).padStart(3, "0")}`}
                                        speed={2}
                                        className="text-sm uppercase tracking-widest"
                                        color={color}
                                    />
                                    <span className="flex items-center gap-1.5 text-xs">
                                        <span
                                            className="h-1.5 w-1.5 animate-pulse rounded-full"
                                            style={{ backgroundColor: color }}
                                        />
                                        {a.is_active === false ? "INACTIVE" : "ACTIVE"}
                                    </span>
                                </div>
                                <h1 className="text-2xl font-bold leading-tight" style={{ color }}>
                                    <DecryptedText
                                        text={a.title}
                                        speed={35}
                                        maxIterations={6}
                                        sequential={true}
                                        revealDirection="start"
                                        animateOn="view"
                                    />
                                </h1>
                            </header>

                            {/* timeline */}
                            <div className="mb-6">
                                <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                                    ── timeline ──
                                </div>
                                <AnimatedList
                                    items={timelineItems}
                                    showGradients={false}
                                    enableArrowNavigation={false}
                                    className="text-xs text-muted-foreground"
                                />
                            </div>

                            {/* affects */}
                            {a.affects && a.affects.length > 0 && (
                                <div className="mb-6 flex flex-wrap gap-1.5">
                                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                        affects:
                                    </span>
                                    {a.affects.map((m) => (
                                        <span
                                            key={m}
                                            className="rounded border border-edge-hairline bg-muted/40 px-1.5 py-0.5 text-[10px]"
                                        >
                                            {m}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* 正文 */}
                            {body && (
                                <div className="mb-6">
                                    <div className="mb-3 text-[10px] uppercase tracking-widest text-muted-foreground">
                                        ── body ──
                                    </div>
                                    <div className="prose prose-sm prose-neutral max-w-none dark:prose-invert">
                                        <ArticleContent content={body} />
                                    </div>
                                </div>
                            )}

                            {/* footer */}
                            <footer className="flex flex-wrap items-center gap-3 border-t border-edge-hairline pt-4 text-xs">
                                <ClickSpark sparkColor={color} sparkCount={8}>
                                    <button
                                        type="button"
                                        className="rounded border border-edge-hairline px-3 py-1 transition-colors hover:bg-muted"
                                    >
                                        ✓ acknowledge
                                    </button>
                                </ClickSpark>
                                <button
                                    type="button"
                                    onClick={handleCopyId}
                                    className="flex items-center gap-1 rounded border border-edge-hairline px-3 py-1 transition-colors hover:bg-muted"
                                >
                                    {copied ? (
                                        <Check className="size-3" />
                                    ) : (
                                        <Copy className="size-3" />
                                    )}
                                    {copied ? "copied" : "copy event id"}
                                </button>
                                <Link
                                    to="/"
                                    className="ml-auto rounded border border-edge-hairline px-3 py-1 transition-colors hover:bg-muted"
                                >
                                    ← back
                                </Link>
                            </footer>
                        </article>
                    </ElectricBorder>
                </div>
            </div>
        </div>
    );
}

export const Route = createFileRoute("/announcements/$id")({
    component: ManifestPage,
});
