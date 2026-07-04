/**
 * AnnouncementCard - 公告卡片（card / article 两态共用）
 *
 * 两态在首页有明确视觉与交互差异：
 * - card（事件票据）：自包含通知，无封面、不可点击、无详情页。
 *   读完即止，content/excerpt 就是全部。
 * - article（事件简报入口）：带封面图 + 「阅读全文 →」引导，
 *   整卡可点击，跳转 /announcements/:id 看正文。
 *
 * 用 SpotlightCard 外壳 + 左侧 severity 色条。标题用 DecryptedText 解码。
 */
import type { Announcement } from "@features/settings/model/types";
import DecryptedText from "@shared/vendor/react-bits/DecryptedText";
import { SpotlightCard } from "@shared/vendor/react-bits/SpotlightCard";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

/** severity → 视觉配置 */
interface SevCfg {
    label: string;
    text: string;
    bar: string;
    badge: string;
}

const SEVERITY: Record<string, SevCfg> = {
    info: {
        label: "info",
        text: "text-neon-cyan",
        bar: "bg-neon-cyan",
        badge: "bg-neon-cyan/10 text-neon-cyan",
    },
    warning: {
        label: "warn",
        text: "text-neon-purple",
        bar: "bg-neon-purple",
        badge: "bg-neon-purple/10 text-neon-purple",
    },
    success: {
        label: "ok",
        text: "text-neon-green",
        bar: "bg-neon-green",
        badge: "bg-neon-green/10 text-neon-green",
    },
    error: {
        label: "error",
        text: "text-neon-pink",
        bar: "bg-neon-pink",
        badge: "bg-neon-pink/10 text-neon-pink",
    },
};

export interface AnnouncementCardProps {
    announcement: Announcement;
}

export default function AnnouncementCard({ announcement: a }: AnnouncementCardProps) {
    const cfg = SEVERITY[a.severity] ?? SEVERITY.info;
    const isArticle = a.display === "article";
    const stamp = a.created_at
        ? new Date(a.created_at).toISOString().slice(0, 16).replace("T", " ")
        : "";

    // 卡片正文（标题 + 摘要 + affects + 底部），card 与 article 共用
    const body = (
        <>
            {/* article 形态：顶部封面图（card 形态无封面） */}
            {isArticle && a.cover_image && (
                <div className="aspect-2/1 w-full overflow-hidden border-b border-edge-hairline">
                    <img
                        src={a.cover_image}
                        alt={a.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                </div>
            )}

            <div className="flex flex-1 flex-col p-5 font-mono">
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
                    {isArticle ? (
                        <span className="flex items-center gap-0.5 font-medium transition-colors group-hover:text-foreground">
                            阅读全文 <ArrowRight className="size-3" />
                        </span>
                    ) : (
                        <span className="opacity-60">standalone</span>
                    )}
                </div>
            </div>
        </>
    );

    // article：整卡可点击，套 Link
    if (isArticle) {
        return (
            <SpotlightCard className="group flex">
                <div className={`w-1 shrink-0 ${cfg.bar}`} aria-hidden />
                <Link
                    to="/announcements/$id"
                    params={{ id: String(a.id) }}
                    className="flex flex-1 flex-col"
                >
                    {body}
                </Link>
            </SpotlightCard>
        );
    }

    // card：自包含，不可点击
    return (
        <SpotlightCard className="group flex">
            <div className={`w-1 shrink-0 ${cfg.bar}`} aria-hidden />
            <div className="flex flex-1 flex-col">{body}</div>
        </SpotlightCard>
    );
}
