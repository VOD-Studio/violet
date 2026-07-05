/**
 * 公告 severity → 视觉配置（单一来源）
 *
 * 供 AnnouncementCard 与公告详情页共用，消除「卡片用 neon / 详情页用 hex」的双轨。
 *
 * 设计取舍：
 * - 配色走 shadcn 友好的 Tailwind 色阶（blue/amber/emerald/red），不用 neon token
 * - BorderGlow 的 glow 三色刻意相同（同 severity 单色），不使用多色 mesh，保持克制
 * - 图标用 lucide，与项目其他 severity/badge 体系一致
 */
import type { AnnouncementSeverity } from "@features/settings/model/types";
import { CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react";
import type { ComponentType } from "react";

export interface AnnouncementSevCfg {
    /** 药丸徽章 class（背景 + 前景，含 dark 变体） */
    badge: string;
    /** 圆点背景 class */
    dot: string;
    /** BorderGlow 配色（HSL 三元组字符串，组件要 HSL "h s%" 形式）；单色模式三值相同 */
    glow: [string, string, string];
    /** lucide 图标组件 */
    Icon: ComponentType<{ className?: string }>;
    /** 中文标签 */
    label: string;
}

export const ANNOUNCEMENT_SEVERITY: Record<AnnouncementSeverity, AnnouncementSevCfg> = {
    info: {
        badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        dot: "bg-blue-500",
        glow: ["217 91 60", "217 91 60", "217 91 60"],
        Icon: Info,
        label: "信息",
    },
    warning: {
        badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        dot: "bg-amber-500",
        glow: ["38 92 50", "38 92 50", "38 92 50"],
        Icon: TriangleAlert,
        label: "警告",
    },
    success: {
        badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        dot: "bg-emerald-500",
        glow: ["152 76 40", "152 76 40", "152 76 40"],
        Icon: CircleCheck,
        label: "成功",
    },
    error: {
        badge: "bg-red-500/10 text-red-600 dark:text-red-400",
        dot: "bg-red-500",
        glow: ["0 84 60", "0 84 60", "0 84 60"],
        Icon: CircleX,
        label: "错误",
    },
};

/** 取 severity 配置，未知值回退到 info */
export function getAnnouncementSev(severity: string | undefined | null): AnnouncementSevCfg {
    if (!severity) return ANNOUNCEMENT_SEVERITY.info;
    return ANNOUNCEMENT_SEVERITY[severity as AnnouncementSeverity] ?? ANNOUNCEMENT_SEVERITY.info;
}
