/** announcement-lab 实验室共享类型与 mock 数据 */

/** 严重程度枚举（值与后端 type 一致，语义重新定义为视觉维度） */
export type LabSeverity = "info" | "warning" | "success" | "error";

/** 实验室公告数据结构（简化自 AnnouncementDTO，只保留展示必需字段） */
export interface LabAnnouncement {
    id: number;
    title: string;
    content: string;
    severity: LabSeverity;
}

/**
 * severity → 视觉配置映射
 *
 * 统一驱动所有原型的配色、标签、图标。
 * 各原型从这里取配置，保证 4 种 severity 在所有原型里视觉一致。
 */
export interface SeverityConfig {
    /** 标签文本 */
    label: string;
    /** Tailwind 文字颜色类（light + dark 通用） */
    textClass: string;
    /** Tailwind 背景色类（带透明度） */
    bgClass: string;
    /** Tailwind 边框色类 */
    borderClass: string;
    /** 字符图标 */
    glyph: string;
}

export const SEVERITY_CONFIG: Record<LabSeverity, SeverityConfig> = {
    info: {
        label: "info",
        textClass: "text-blue-500 dark:text-blue-400",
        bgClass: "bg-blue-500/10",
        borderClass: "border-blue-500/40",
        glyph: "ℹ",
    },
    warning: {
        label: "warn",
        textClass: "text-amber-500 dark:text-amber-400",
        bgClass: "bg-amber-500/10",
        borderClass: "border-amber-500/40",
        glyph: "⚠",
    },
    success: {
        label: "ok",
        textClass: "text-emerald-500 dark:text-emerald-400",
        bgClass: "bg-emerald-500/10",
        borderClass: "border-emerald-500/40",
        glyph: "✓",
    },
    error: {
        label: "error",
        textClass: "text-red-500 dark:text-red-400",
        bgClass: "bg-red-500/10",
        borderClass: "border-red-500/40",
        glyph: "✕",
    },
};

/** 4 条 mock 公告，覆盖全部 severity，贴近真实运营场景 */
export const MOCK_ANNOUNCEMENTS: LabAnnouncement[] = [
    {
        id: 1,
        title: "站点升级到 2.0",
        content: "评论系统重构完成，新增 Markdown 实时预览",
        severity: "success",
    },
    {
        id: 2,
        title: "周六数据库维护",
        content: "02:00-04:00 暂停服务，请提前保存草稿",
        severity: "warning",
    },
    {
        id: 3,
        title: "评论鉴权异常已修复",
        content: "GitHub OAuth 回调 URL 已修正，登录恢复正常",
        severity: "info",
    },
    {
        id: 4,
        title: "图片服务降级",
        content: "CDN 节点故障，图片加载可能延迟，正在抢修",
        severity: "error",
    },
];
