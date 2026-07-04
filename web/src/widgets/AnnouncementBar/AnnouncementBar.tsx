/**
 * AnnouncementBar - 生产公告条（N 面多面体形态）
 *
 * 消费 GET /api/v1/announcements，只渲染 display=banner 的公告。
 * N 条公告 = N 面棱柱，所有面同时存在于 3D 空间绕 X 轴排列，
 * 容器整体 rotateX 旋转到当前面（4 条=4 面体每面 90°，5 条=5 面体每面 72°）。
 * 这是真正的多面体，不是平面翻牌。
 *
 * 不变约束（见 CONTEXT.md）：
 * - 排序权威是后端返回顺序（sort_order ASC, created_at DESC），前端不重排
 * - 关闭即标记当前可见全部 id 为已读（localStorage），新 id 出现才重现
 * - WCAG 2.2.2：hover 暂停、滚轮可手动翻、prefers-reduced-motion 降级为静态
 */
import { useAnnouncements } from "@features/settings/api/queries";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "announcement:read-ids";
const FLIP_EASE = [0.4, 0, 0.2, 1] as const;
const FLIP_DURATION = 0.6;
const AUTO_INTERVAL = 5000;
const FACE_HEIGHT = 28; // 每面高度 px（h-7）

/** severity → neon 色板映射（信息=青/警告=粉/成功=绿/错误=粉红，区分明显） */
const SEVERITY_STYLE: Record<string, { text: string; glyph: string; label: string }> = {
    info: { text: "text-neon-cyan", glyph: "◆", label: "info" },
    warning: { text: "text-neon-purple", glyph: "▲", label: "warn" },
    success: { text: "text-neon-green", glyph: "●", label: "ok" },
    error: { text: "text-neon-pink", glyph: "✕", label: "error" },
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

/**
 * 计算 N 面棱柱的每面 transform。
 * - 每面绕 X 轴的角度：360/N * i
 * - translateZ 深度（棱柱内切半径）：(FACE_HEIGHT/2) / tan(180°/N)
 *   保证相邻面正好相接，形成闭合棱柱。
 */
function faceTransform(i: number, n: number): string {
    const angle = (360 / n) * i;
    const depth = FACE_HEIGHT / 2 / Math.tan(Math.PI / n);
    return `rotateX(${angle}deg) translateZ(${depth}px)`;
}

export default function AnnouncementBar() {
    const { data } = useAnnouncements();
    const prefersReducedMotion = usePrefersReducedMotion();
    const [index, setIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [readIds, setReadIds] = useState<Set<number>>(() => readReadIds());

    const banners = useMemo(
        () => (data ?? []).filter((a) => a.display === "banner").filter((a) => !readIds.has(a.id)),
        [data, readIds],
    );

    const current = banners[index];
    const n = banners.length;

    // 自动推进
    useEffect(() => {
        if (isPaused || prefersReducedMotion || n <= 1) return;
        const timer = window.setInterval(() => setIndex((i) => (i + 1) % n), AUTO_INTERVAL);
        return () => window.clearInterval(timer);
    }, [isPaused, prefersReducedMotion, n]);

    // 重置 index 防越界
    useEffect(() => {
        if (index >= n) setIndex(0);
    }, [n, index]);

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

    // 单条：直接静态展示，不做多面体（1 面无需旋转）
    if (n === 1 || prefersReducedMotion) {
        return (
            <div className="relative border-b border-edge-hairline bg-primary/95 font-mono text-xs dark:bg-zinc-900">
                <div className={`flex h-7 items-center justify-center gap-2 px-12 ${cfg.text}`}>
                    <span className="shrink-0">{cfg.glyph}</span>
                    <span className="shrink-0 opacity-60">[{cfg.label}]</span>
                    <span className="truncate text-primary-foreground dark:text-foreground">
                        {current.content}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={handleClose}
                    aria-label="关闭公告"
                    className="absolute top-1/2 right-3 z-10 -translate-y-1/2 text-primary-foreground/70 transition-colors hover:text-primary-foreground dark:text-foreground/70 dark:hover:text-foreground"
                >
                    ✕
                </button>
            </div>
        );
    }

    // 多条：N 面棱柱，容器整体 rotateX 到当前面
    const targetRotation = -(360 / n) * index;

    return (
        <div
            className="relative border-b border-edge-hairline bg-primary/95 font-mono text-xs dark:bg-zinc-900"
            style={{ perspective: "800px" }}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onWheel={(e) => {
                if (Math.abs(e.deltaY) < 10) return;
                if (e.deltaY > 0) setIndex((i) => (i + 1) % n);
                else setIndex((i) => (i - 1 + n) % n);
            }}
        >
            <motion.div
                className="relative"
                style={{ transformStyle: "preserve-3d", height: FACE_HEIGHT }}
                animate={{ rotateX: targetRotation }}
                transition={{ duration: FLIP_DURATION, ease: FLIP_EASE }}
            >
                {banners.map((a, i) => {
                    const fcfg = SEVERITY_STYLE[a.severity] ?? SEVERITY_STYLE.info;
                    return (
                        <div
                            key={a.id}
                            className={`absolute inset-0 flex items-center justify-center gap-2 px-12 backface-hidden ${fcfg.text}`}
                            style={{ transform: faceTransform(i, n) }}
                        >
                            <span className="shrink-0">{fcfg.glyph}</span>
                            <span className="shrink-0 opacity-60">[{fcfg.label}]</span>
                            <span className="truncate text-primary-foreground dark:text-foreground">
                                {a.content}
                            </span>
                        </div>
                    );
                })}
            </motion.div>

            <button
                type="button"
                onClick={handleClose}
                aria-label="关闭公告"
                className="absolute top-1/2 right-3 z-10 -translate-y-1/2 text-primary-foreground/70 transition-colors hover:text-primary-foreground dark:text-foreground/70 dark:hover:text-foreground"
            >
                ✕
            </button>

            <span className="absolute top-1/2 left-3 z-10 -translate-y-1/2 font-mono text-[10px] text-primary-foreground/50 dark:text-foreground/50">
                {index + 1}/{n}
            </span>
        </div>
    );
}
