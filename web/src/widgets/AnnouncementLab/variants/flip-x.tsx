/**
 * FlipX - 原型 ①：Split-flap 翻牌（绕 X 轴）
 *
 * 模拟机场航班告示牌（split-flap display）：切换时当前叶片向上翻走、
 * 新叶片从底部翻入，翻转过程中（约 90° 时）两个面同时侧立于 3D 空间，
 * 配合 perspective 透视产生真实的多面体厚度感。
 *
 * 实现：AnimatePresence mode="popLayout" 让新旧面在退出/进入瞬间共存。
 * - 当前面 exit：rotateX 0 → -180（向上翻走，backface-hidden 后半段隐藏背面）
 * - 新面 initial：rotateX 180 → animate 0（从底部翻入）
 * 翻到 90° 附近时两面都侧立，perspective 让厚度可见。
 *
 * WCAG 兜底：prefers-reduced-motion 下退化为 opacity 淡入淡出，不做 3D 翻转。
 */
import { AnimatePresence, motion } from "motion/react";
import { MOCK_ANNOUNCEMENTS, SEVERITY_CONFIG } from "./types";
import { useRotation } from "./use-rotation";

const FLIP_EASE = [0.4, 0, 0.2, 1] as const;

export function FlipX() {
    const rotation = useRotation(MOCK_ANNOUNCEMENTS, 3500);
    const { current, index, total, prefersReducedMotion, onHoverStart, onHoverEnd, onWheel } =
        rotation;
    const cfg = SEVERITY_CONFIG[current.severity];

    return (
        <div
            className="flex h-full w-full flex-col items-center justify-center gap-3"
            onMouseEnter={onHoverStart}
            onMouseLeave={onHoverEnd}
            onWheel={onWheel}
        >
            <div className="relative h-20 w-full max-w-md" style={{ perspective: "600px" }}>
                <div className="relative h-full w-full" style={{ transformStyle: "preserve-3d" }}>
                    <AnimatePresence mode="popLayout">
                        <motion.div
                            key={current.id}
                            className={`absolute inset-0 flex flex-col items-center justify-center rounded-lg border ${cfg.borderClass} ${cfg.bgClass} px-4 py-3 font-mono backface-hidden`}
                            initial={
                                prefersReducedMotion ? { opacity: 0 } : { rotateX: 180, opacity: 1 }
                            }
                            animate={
                                prefersReducedMotion ? { opacity: 1 } : { rotateX: 0, opacity: 1 }
                            }
                            exit={
                                prefersReducedMotion
                                    ? { opacity: 0 }
                                    : { rotateX: -180, opacity: 1 }
                            }
                            transition={{ duration: 0.6, ease: FLIP_EASE }}
                        >
                            <div
                                className={`mb-1 text-xs uppercase tracking-widest ${cfg.textClass}`}
                            >
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
