/**
 * AnnouncementCard - 公告事件票据（card 形态）
 *
 * 渲染为「事件票据」而非文章卡片。核心区别于 PostCard：
 * 无封面图、无作者、无标签、无阅读时长——这些是「作品」属性，
 * 公告是「事件」没有。
 *
 * 用项目已验证可用的 SpotlightCard 作外壳（不依赖硬编码尺寸的 react-bits），
 * severity 通过左侧色条 + 配色表达。标题用 DecryptedText 解码入场。
 * 点击整卡跳转 article 详情页 /announcements/:id。
 */
import type { Announcement } from "@features/settings/model/types";
import DecryptedText from "@shared/vendor/react-bits/DecryptedText";
import { SpotlightCard } from "@shared/vendor/react-bits/SpotlightCard";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

/** severity → 视觉配置 */
interface SevCfg {
    label: string;
    text: string;
    /** 左侧色条颜色（Tailwind bg 类） */
    bar: string;
    /** 标签徽章背景 + 文字 */
    badge: string;
}

const SEVERITY: Record<string, SevCfg> = {
    info: {
        label: "info",
        text: "text-blue-500 dark:text-neon-blue",
        bar: "bg-blue-500 dark:bg-neon-blue",
        badge: "bg-blue-500/10 text-blue-500 dark:bg-neon-blue/10 dark:text-neon-blue",
    },
    warning: {
        label: "warn",
        text: "text-amber-500 dark:text-amber-400",
        bar: "bg-amber-500 dark:bg-amber-400",
        badge: "bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400",
    },
    success: {
        label: "ok",
        text: "text-emerald-500 dark:text-emerald-400",
        bar: "bg-emerald-500 dark:bg-emerald-400",
        badge: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400",
    },
    error: {
        label: "error",
        text: "text-red-500 dark:text-red-400",
        bar: "bg-red-500 dark:bg-red-400",
        badge: "bg-red-500/10 text-red-600 dark:bg-red-400/10 dark:text-red-400",
    },
};

export interface AnnouncementCardProps {
    announcement: Announcement;
}

export default function AnnouncementCard({ announcement: a }: AnnouncementCardProps) {
    const cfg = SEVERITY[a.severity] ?? SEVERITY.info;
    const stamp = a.created_at
        ? new Date(a.created_at).toISOString().slice(0, 16).replace("T", " ")
        : "";

    return (
        <SpotlightCard className="group flex">
            {/* severity 左侧色条 */}
            <div className={`w-1 shrink-0 ${cfg.bar}`} aria-hidden />
            <Link
                to="/announcements/$id"
                params={{ id: String(a.id) }}
                className="flex flex-1 flex-col p-5 font-mono"
            >
                {/* 顶部 metadata */}
                <div className="mb-3 flex items-center justify-between">
                    <span
                        className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-widest ${cfg.badge}`}
                    >
                        {cfg.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                        EVENT #{String(a.id).padStart(3, "0")}
                    </span>
                </div>

                {/* 标题(解码) */}
                <h3
                    className={`mb-2 flex items-start gap-1 text-lg font-semibold leading-snug ${cfg.text}`}
                >
                    <span className="shrink-0">▸</span>
                    <DecryptedText
                        text={a.title}
                        speed={35}
                        maxIterations={6}
                        sequential={true}
                        revealDirection="start"
                        animateOn="view"
                    />
                </h3>

                {/* 摘要 */}
                <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
                    {a.excerpt || a.content}
                </p>

                {/* affects 标签 */}
                {a.affects && a.affects.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1">
                        {a.affects.slice(0, 4).map((m) => (
                            <span
                                key={m}
                                className="rounded border border-edge-hairline bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                            >
                                {m}
                            </span>
                        ))}
                    </div>
                )}

                {/* 底部票据区 */}
                <div className="mt-auto flex items-center justify-between border-t border-edge-hairline pt-2 text-[10px] text-muted-foreground">
                    <span>{stamp}</span>
                    <span className="flex items-center gap-0.5 transition-colors group-hover:text-foreground">
                        open manifest <ArrowUpRight className="size-3" />
                    </span>
                </div>
            </Link>
        </SpotlightCard>
    );
}
