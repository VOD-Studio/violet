/**
 * AnnouncementCard - 公告事件票据（card 形态）
 *
 * 渲染为「事件票据」而非文章卡片。核心区别于 PostCard：
 * 无封面图、无作者、无标签、无阅读时长——这些是「作品」属性，
 * 公告是「事件」没有。视觉用 react-bits 的像素/电流/金属光泽原子搭建。
 *
 * 结构（见 CONTEXT.md「事件票据」）：
 * - 外壳 PixelCard（像素故障感）
 * - severity=error/warning 时包 ElectricBorder（电流流动）
 * - 顶部 metadata：EVENT #id · severity · ACTIVE（ShinyText）
 * - 标题 DecryptedText 解码入场 + ▸ 终端提示符
 * - 底部票据区：时间戳 + 详情链接（CountUp 事件号）
 *
 * 点击整卡跳转 article 详情页 /announcements/:id
 */

import type { Announcement } from "@features/settings/model/types";
import CountUp from "@shared/vendor/react-bits/CountUp/CountUp";
import DecryptedText from "@shared/vendor/react-bits/DecryptedText";
import ElectricBorder from "@shared/vendor/react-bits/ElectricBorder/ElectricBorder";
import PixelCard from "@shared/vendor/react-bits/PixelCard/PixelCard";
import ShinyText from "@shared/vendor/react-bits/ShinyText/ShinyText";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

/** severity → 视觉配置 */
interface SevCfg {
    label: string;
    text: string;
    /** ElectricBorder 电流色（十六进制） */
    electric: string;
    /** ShinyText 金属光泽色 */
    shine: string;
}

const SEVERITY: Record<string, SevCfg> = {
    info: {
        label: "info",
        text: "text-blue-500 dark:text-neon-blue",
        electric: "#3b82f6",
        shine: "#60a5fa",
    },
    warning: {
        label: "warn",
        text: "text-amber-500 dark:text-amber-400",
        electric: "#f59e0b",
        shine: "#fbbf24",
    },
    success: {
        label: "ok",
        text: "text-emerald-500 dark:text-emerald-400",
        electric: "#10b981",
        shine: "#34d399",
    },
    error: {
        label: "error",
        text: "text-red-500 dark:text-red-400",
        electric: "#ef4444",
        shine: "#f87171",
    },
};

export interface AnnouncementCardProps {
    announcement: Announcement;
}

export default function AnnouncementCard({ announcement: a }: AnnouncementCardProps) {
    const cfg = SEVERITY[a.severity] ?? SEVERITY.info;
    const showElectric = a.severity === "error" || a.severity === "warning";
    const stamp = a.created_at
        ? new Date(a.created_at).toISOString().slice(0, 16).replace("T", " ")
        : "";

    const inner = (
        <PixelCard variant="default" gap={6} speed={2} className="h-full">
            <Link
                to="/announcements/$id"
                params={{ id: String(a.id) }}
                className="flex h-full flex-col p-5 font-mono"
            >
                {/* 顶部 metadata */}
                <div className="mb-3 flex items-center justify-between text-xs">
                    <ShinyText
                        text={`EVENT #${String(a.id).padStart(3, "0")} · ${cfg.label}`}
                        speed={2.5}
                        className={`uppercase tracking-widest ${cfg.text}`}
                        color={cfg.shine}
                    />
                    <span className="flex items-center gap-1 text-emerald-500">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                        ACTIVE
                    </span>
                </div>

                {/* 标题(解码) */}
                <h3
                    className={`mb-1 flex items-start gap-1 text-lg font-semibold leading-snug ${cfg.text}`}
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
                    <span className="flex items-center gap-1">
                        stamp
                        <CountUp to={a.id} duration={1.2} className="tabular-nums" />
                        <span className="opacity-60">· {stamp}</span>
                    </span>
                    <span className="flex items-center gap-0.5 transition-colors hover:text-foreground">
                        open manifest <ArrowUpRight className="size-3" />
                    </span>
                </div>
            </Link>
        </PixelCard>
    );

    if (!showElectric) return inner;

    return (
        <ElectricBorder color={cfg.electric} speed={1.5} chaos={0.1} borderRadius={12}>
            {inner}
        </ElectricBorder>
    );
}
