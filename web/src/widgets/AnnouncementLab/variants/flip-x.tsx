/**
 * FlipX - 原型 ①：3D rotateX 翻转
 *
 * 卡片绕 X 轴翻面切换公告：旧条向上翻出、新条从底部翻入（类机场航班告示牌）。
 * 用 useRotation 驱动（自动推进 + hover 暂停 + 滚轮手动）。
 *
 * WCAG 兜底：prefers-reduced-motion 下退化为 opacity 淡入淡出，不做 3D 翻转。
 */
import { AnimatePresence, motion } from "motion/react";
import { MOCK_ANNOUNCEMENTS, SEVERITY_CONFIG } from "./types";
import { useRotation } from "./use-rotation";

export function FlipX() {
    const rotation = useRotation(MOCK_ANNOUNCEMENTS, 3500);
    const { current, index, total, prefersReducedMotion, onHoverStart, onHoverEnd, onWheel } =
        rotation;
    const cfg = SEVERITY_CONFIG[current.severity];

    return (
        <div
            className="flex h-full w-full flex-col items-center justify-center gap-3"
            style={{ perspective: "800px" }}
            onMouseEnter={onHoverStart}
            onMouseLeave={onHoverEnd}
            onWheel={onWheel}
        >
            <div
                className="relative h-20 w-full max-w-md"
                style={{ transformStyle: "preserve-3d" }}
            >
                <AnimatePresence mode="popLayout">
                    <motion.div
                        key={current.id}
                        className={`absolute inset-0 flex flex-col items-center justify-center rounded-lg border ${cfg.borderClass} ${cfg.bgClass} px-4 py-3 font-mono`}
                        initial={
                            prefersReducedMotion ? { opacity: 0 } : { rotateX: -90, opacity: 0 }
                        }
                        animate={prefersReducedMotion ? { opacity: 1 } : { rotateX: 0, opacity: 1 }}
                        exit={prefersReducedMotion ? { opacity: 0 } : { rotateX: 90, opacity: 0 }}
                        transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
                    >
                        <div className={`mb-1 text-xs uppercase tracking-widest ${cfg.textClass}`}>
                            {cfg.glyph} [{cfg.label}]
                        </div>
                        <div className={`text-sm font-semibold ${cfg.textClass}`}>
                            {current.title}
                        </div>
                        <div className="mt-0.5 text-center text-xs text-muted-foreground">
                            {current.content}
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* 指示器 + 计数 */}
            <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                {MOCK_ANNOUNCEMENTS.map((a, i) => (
                    <span
                        key={a.id}
                        className={`h-1.5 rounded-full transition-all ${
                            i === index ? "w-4 bg-foreground" : "w-1.5 bg-muted-foreground/40"
                        }`}
                    />
                ))}
                <span className="ml-1">
                    {index + 1}/{total}
                </span>
            </div>
        </div>
    );
}
