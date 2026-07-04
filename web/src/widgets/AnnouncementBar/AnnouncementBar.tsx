/**
 * AnnouncementBar - 生产公告条（FlipX split-flap 形态）
 *
 * 消费 GET /api/v1/announcements，只渲染 display=banner 的公告，
 * 采用 split-flap 3D 翻牌切换（实验室选定的形态）。
 *
 * 不变约束（见 CONTEXT.md）：
 * - 排序权威是后端返回顺序（sort_order ASC, created_at DESC），前端不重排
 * - 关闭即标记当前可见全部 id 为已读（localStorage），新 id 出现才重现
 * - WCAG 2.2.2：hover 暂停、滚轮可手动翻、prefers-reduced-motion 降级
 */

import { useAnnouncements } from "@features/settings/api/queries";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "announcement:read-ids";
const FLIP_EASE = [0.4, 0, 0.2, 1] as const;
const FLIP_DURATION = 0.6;
const AUTO_INTERVAL = 5000;

/** severity → 视觉配置 */
const SEVERITY_STYLE: Record<string, { text: string; bg: string; glyph: string }> = {
    info: { text: "text-blue-500 dark:text-neon-blue", bg: "bg-blue-500/10", glyph: "ℹ" },
    warning: { text: "text-amber-500 dark:text-amber-400", bg: "bg-amber-500/10", glyph: "⚠" },
    success: {
        text: "text-emerald-500 dark:text-emerald-400",
        bg: "bg-emerald-500/10",
        glyph: "✓",
    },
    error: { text: "text-red-500 dark:text-red-400", bg: "bg-red-500/10", glyph: "✕" },
};

/** 读取已读 id 集合 */
function readReadIds(): Set<number> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return new Set();
        return new Set(JSON.parse(raw).map(Number));
    } catch {
        return new Set();
    }
}

/** 检测 prefers-reduced-motion */
function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return;
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        setReduced(mq.matches);
        const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);
    return reduced;
}

export default function AnnouncementBar() {
    const { data } = useAnnouncements();
    const prefersReducedMotion = usePrefersReducedMotion();
    const [index, setIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [readIds, setReadIds] = useState<Set<number>>(() => readReadIds());

    // 只显示 banner 形态 + 未读的公告
    const banners = useMemo(
        () => (data ?? []).filter((a) => a.display === "banner").filter((a) => !readIds.has(a.id)),
        [data, readIds],
    );

    const current = banners[index];

    // 自动推进
    useEffect(() => {
        if (isPaused || prefersReducedMotion || banners.length <= 1) return;
        const timer = window.setInterval(
            () => setIndex((i) => (i + 1) % banners.length),
            AUTO_INTERVAL,
        );
        return () => window.clearInterval(timer);
    }, [isPaused, prefersReducedMotion, banners.length]);

    // 重置 index 防越界
    useEffect(() => {
        if (index >= banners.length) setIndex(0);
    }, [banners.length, index]);

    /** 关闭：把当前所有可见 banner id 标记已读 */
    const handleClose = () => {
        const ids = banners.map((a) => a.id);
        const next = new Set([...readIds, ...ids]);
        setReadIds(next);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
        } catch {
            /* localStorage 不可用时静默降级 */
        }
    };

    if (!current) return null;
    const cfg = SEVERITY_STYLE[current.severity] ?? SEVERITY_STYLE.info;

    return (
        <div
            className="relative border-b border-edge-hairline bg-primary/95 font-mono text-xs dark:bg-neon-purple/10"
            style={{ perspective: "600px" }}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onWheel={(e) => {
                if (Math.abs(e.deltaY) < 10) return;
                if (e.deltaY > 0) setIndex((i) => (i + 1) % banners.length);
                else setIndex((i) => (i - 1 + banners.length) % banners.length);
            }}
        >
            <div className="relative h-7" style={{ transformStyle: "preserve-3d" }}>
                <AnimatePresence mode="popLayout">
                    <motion.div
                        key={current.id}
                        className={`absolute inset-0 flex items-center justify-center gap-2 px-12 ${cfg.text} ${cfg.bg}`}
                        initial={
                            prefersReducedMotion ? { opacity: 0 } : { rotateX: 180, opacity: 1 }
                        }
                        animate={prefersReducedMotion ? { opacity: 1 } : { rotateX: 0, opacity: 1 }}
                        exit={prefersReducedMotion ? { opacity: 0 } : { rotateX: -180, opacity: 1 }}
                        transition={{ duration: FLIP_DURATION, ease: FLIP_EASE }}
                    >
                        <span className="shrink-0">{cfg.glyph}</span>
                        <span className="shrink-0 opacity-60">[{current.severity}]</span>
                        <span className="truncate text-primary-foreground dark:text-foreground">
                            {current.content}
                        </span>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* 关闭按钮 */}
            <button
                type="button"
                onClick={handleClose}
                aria-label="关闭公告"
                className="absolute top-1/2 right-3 z-10 -translate-y-1/2 text-primary-foreground/70 transition-colors hover:text-primary-foreground dark:text-foreground/70 dark:hover:text-foreground"
            >
                ✕
            </button>

            {/* 多条时的计数指示 */}
            {banners.length > 1 && (
                <span className="absolute top-1/2 left-3 z-10 -translate-y-1/2 font-mono text-[10px] text-primary-foreground/50 dark:text-foreground/50">
                    {index + 1}/{banners.length}
                </span>
            )}
        </div>
    );
}
