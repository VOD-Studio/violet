/**
 * /announcements/$id - 公告详情页（article 形态）
 *
 * 去赛博化后的视觉语言：
 * - 标题用 BlurText 按词模糊渐显，替代 DecryptedText 解码
 * - 时间轴用 AnimatedList（可点击、键盘 ↑↓/Enter 选择），替代静态终端 timeline 块
 * - 按钮用 Magnet 磁吸微交互，替代 ClickSpark 粒子火花
 * - severity 配色走 shared/announcement-severity（shadcn 色阶），替代硬编码 hex
 * - 去掉「事件简报 Event Manifest」终端定位文案与 font-mono 装饰
 */

import { useAnnouncement } from "@features/settings/api/queries";
import ArticleContent from "@shared/ui/markdown-preview/ArticleContent";
import { getAnnouncementSev } from "@shared/ui/announcement-severity";
import AnimatedList from "@vendor/react-bits/AnimatedList";
import BlurText from "@vendor/react-bits/BlurText";
import Magnet from "@vendor/react-bits/Magnet";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Copy } from "lucide-react";
import { useMemo, useState } from "react";

function AnnouncementDetailPage() {
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
                <h1 className="mb-3 text-2xl font-bold">公告不存在</h1>
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

    const cfg = getAnnouncementSev(a.severity);
    const stamp = a.created_at
        ? new Date(a.created_at).toISOString().replace("T", " ").slice(0, 16)
        : "—";
    const windowRange =
        a.start_time || a.end_time
            ? `${a.start_time ? new Date(a.start_time).toISOString().slice(0, 16) : "—"} → ${a.end_time ? new Date(a.end_time).toISOString().slice(0, 16) : "—"}`
            : "无生效窗口";
    const body = a.content_html?.trim() ? a.content_html : a.content_md || a.content;

    const handleCopyId = async () => {
        try {
            await navigator.clipboard.writeText(String(a.id));
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            /* clipboard 不可用时静默 */
        }
    };

    return (
        <div className="container mx-auto px-6 py-16">
            <Link
                to="/"
                className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
                <ArrowLeft className="size-4" />
                返回
            </Link>

            <article className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-8">
                {/* 头部 */}
                <header className="mb-6 border-b border-edge-hairline pb-4">
                    <div className="mb-3 flex items-center justify-between">
                        <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.badge}`}
                        >
                            <cfg.Icon className="size-3" />
                            {cfg.label}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs">
                            <span className={`size-1.5 animate-pulse rounded-full ${cfg.dot}`} />
                            {a.is_active === false ? "已失效" : "生效中"}
                        </span>
                    </div>
                    <BlurText
                        text={a.title}
                        animateBy="words"
                        stepDuration={0.4}
                        delay={60}
                        className="text-2xl font-bold leading-tight text-foreground"
                    />
                </header>

                {/* 时间轴（可交互列表） */}
                <Timeline a={a} stamp={stamp} windowRange={windowRange} />

                {/* affects */}
                {a.affects && a.affects.length > 0 && (
                    <div className="mb-6 flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">影响范围：</span>
                        {a.affects.map((m) => (
                            <span
                                key={m}
                                className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                            >
                                {m}
                            </span>
                        ))}
                    </div>
                )}

                {/* 正文 */}
                {body && (
                    <div className="mb-6">
                        <div className="mb-3 text-xs text-muted-foreground">正文</div>
                        <div className="prose prose-sm prose-neutral max-w-none dark:prose-invert">
                            <ArticleContent content={body} />
                        </div>
                    </div>
                )}

                {/* footer */}
                <footer className="flex flex-wrap items-center gap-3 border-t border-edge-hairline pt-4 text-xs">
                    <Magnet magnetStrength={4} padding={30}>
                        <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-full border border-edge-hairline px-4 py-1.5 transition-colors hover:bg-muted"
                        >
                            <Check className="size-3" />
                            确认已读
                        </button>
                    </Magnet>
                    <button
                        type="button"
                        onClick={handleCopyId}
                        className="inline-flex items-center gap-1 rounded-full border border-edge-hairline px-4 py-1.5 transition-colors hover:bg-muted"
                    >
                        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                        {copied ? "已复制" : "复制 ID"}
                    </button>
                    <Link
                        to="/"
                        className="ml-auto rounded-full border border-edge-hairline px-4 py-1.5 transition-colors hover:bg-muted"
                    >
                        ← 返回
                    </Link>
                </footer>
            </article>
        </div>
    );
}

/**
 * Timeline - 时间轴子组件
 *
 * 用 AnimatedList 渲染事件节点，覆盖其默认深色背景为透明以适配浅色主题。
 */
function Timeline({
    a,
    stamp,
    windowRange,
}: {
    a: { is_active?: boolean };
    stamp: string;
    windowRange: string;
}) {
    const items = useMemo(
        () => [
            `开启时间　${stamp}`,
            `生效窗口　${windowRange}`,
            `当前状态　${a.is_active === false ? "已失效" : "生效中"}`,
        ],
        [stamp, windowRange, a.is_active],
    );

    return (
        <div className="mb-6">
            <div className="mb-2 text-xs text-muted-foreground">事件时间轴</div>
            <AnimatedList
                items={items}
                initialSelectedIndex={0}
                className="!w-full"
                itemClassName="!bg-transparent !p-2 !mb-1"
            />
        </div>
    );
}

export const Route = createFileRoute("/announcements/$id")({
    component: AnnouncementDetailPage,
});
