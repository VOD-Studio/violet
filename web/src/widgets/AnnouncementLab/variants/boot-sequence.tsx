/**
 * BootSequence - 原型 ⑩：Boot Sequence 一次性开机
 *
 * 模拟系统启动序列：页面加载时逐行 stagger 打印 mock 公告（像开机 log），
 * 全部打印完停留几秒，可「重启」重新播放。
 *
 * 与 MOTD 终端的区别：MOTD 是常驻多行（被动看），
 * Boot 是一次性仪式（主动放完动画后静止）。
 *
 * WCAG 兜底：prefers-reduced-motion 下跳过 stagger，直接全部显示。
 */
import { motion } from "motion/react";
import { useCallback, useState } from "react";
import { MOCK_ANNOUNCEMENTS, SEVERITY_CONFIG } from "./types";
import { useRotation } from "./use-rotation";

export function BootSequence() {
    const [runId, setRunId] = useState(0);
    const { index, onHoverStart, onHoverEnd, onWheel, prefersReducedMotion } = useRotation(
        MOCK_ANNOUNCEMENTS,
        999999, // 不自动推进，由 stagger 动画驱动展示节奏
    );

    const reboot = useCallback(() => setRunId((n) => n + 1), []);

    return (
        <div
            className="flex h-full w-full flex-col rounded-lg border border-edge-hairline bg-zinc-950 p-4 font-mono text-xs"
            onMouseEnter={onHoverStart}
            onMouseLeave={onHoverEnd}
            onWheel={onWheel}
        >
            <div className="mb-2 text-zinc-500">
                <span className="text-emerald-500">$</span> init announcement-service
            </div>

            <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto">
                {MOCK_ANNOUNCEMENTS.map((item, i) => {
                    const cfg = SEVERITY_CONFIG[item.severity];
                    const isActive = i === index;
                    return (
                        <motion.div
                            key={`${runId}-${item.id}`}
                            className={`flex items-start gap-2 ${isActive ? "text-zinc-200" : "text-zinc-500"}`}
                            initial={prefersReducedMotion ? false : { opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={
                                prefersReducedMotion
                                    ? { duration: 0 }
                                    : { delay: 0.3 + i * 0.5, duration: 0.3 }
                            }
                        >
                            <span className={`shrink-0 ${cfg.textClass}`}>[{cfg.label}]</span>
                            <span>{item.content}</span>
                        </motion.div>
                    );
                })}
            </div>

            <motion.div
                className="mt-2 text-zinc-500"
                initial={prefersReducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={
                    prefersReducedMotion
                        ? { duration: 0 }
                        : { delay: 0.3 + MOCK_ANNOUNCEMENTS.length * 0.5 }
                }
            >
                <span className="text-emerald-500">✓</span> boot complete ·{" "}
                <button
                    type="button"
                    onClick={reboot}
                    className="text-zinc-400 underline-offset-2 hover:underline"
                >
                    ↻ reboot
                </button>
            </motion.div>
        </div>
    );
}
