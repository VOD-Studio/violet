/**
 * CubeFlipY - 原型 ⑥：CubeToggle 式 Y 轴翻立方
 *
 * 复刻 theme-lab/variants/cube-toggle.tsx 的 rotateY + preserve-3d 手法，
 * 但立方体的每个面承载一条公告（最多 4 条 = 4 面，每面 90°）。
 * 点击切下一面，配合 useRotation 同步 index。
 *
 * WCAG 兜底：prefers-reduced-motion 下退化为 opacity 淡入淡出（无 3D 旋转）。
 *
 * 与 FlipX 的对比点：X 翻是「单槽位翻牌」（一次看一条），
 * Y 翻是「立方体旋转」（暗示多条共存于一个 3D 物体）。
 */
import { motion } from "motion/react";
import { useState } from "react";
import { MOCK_ANNOUNCEMENTS, SEVERITY_CONFIG } from "./types";
import { useRotation } from "./use-rotation";

// 4 面，每面间隔 90°
const FACE_ROTATIONS = [0, 90, 180, 270];

export function CubeFlipY() {
    const [rotation, setRotation] = useState(0);
    const rotationState = useRotation(MOCK_ANNOUNCEMENTS, 4500);
    const { current, index, prefersReducedMotion, onHoverStart, onHoverEnd, onWheel } =
        rotationState;

    const handleClick = () => {
        const nextIdx = (index + 1) % MOCK_ANNOUNCEMENTS.length;
        rotationState.goTo(nextIdx);
        // 顺时针累加 90°，保证方向单调，避免回弹
        setRotation((r) => r + 90);
    };

    const cfg = SEVERITY_CONFIG[current.severity];

    return (
        <div
            className="flex h-full w-full flex-col items-center justify-center gap-4"
            onMouseEnter={onHoverStart}
            onMouseLeave={onHoverEnd}
            onWheel={onWheel}
        >
            {prefersReducedMotion ? (
                /* reduced-motion 降级：opacity 淡入淡出，无 3D */
                <motion.div
                    key={current.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`flex h-20 w-full max-w-md flex-col items-center justify-center rounded-lg border ${cfg.borderClass} ${cfg.bgClass} px-4 py-3 font-mono`}
                >
                    <div className={`mb-1 text-xs uppercase tracking-widest ${cfg.textClass}`}>
                        {cfg.glyph} [{cfg.label}]
                    </div>
                    <div className={`text-sm font-semibold ${cfg.textClass}`}>{current.title}</div>
                </motion.div>
            ) : (
                <div
                    className="relative flex h-20 w-72 items-center justify-center"
                    style={{ perspective: "800px" }}
                >
                    <motion.div
                        className="relative h-20 w-72"
                        style={{ transformStyle: "preserve-3d" }}
                        animate={{ rotateY: rotation }}
                        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                    >
                        {MOCK_ANNOUNCEMENTS.map((item, i) => {
                            const faceCfg = SEVERITY_CONFIG[item.severity];
                            return (
                                <div
                                    key={item.id}
                                    className={`absolute inset-0 flex flex-col items-center justify-center rounded-lg border ${faceCfg.borderClass} ${faceCfg.bgClass} px-4 py-3 font-mono backface-hidden`}
                                    style={{
                                        transform: `rotateY(${FACE_ROTATIONS[i]}deg) translateZ(144px)`,
                                    }}
                                >
                                    <div
                                        className={`mb-1 text-xs uppercase tracking-widest ${faceCfg.textClass}`}
                                    >
                                        {faceCfg.glyph} [{faceCfg.label}]
                                    </div>
                                    <div className={`text-sm font-semibold ${faceCfg.textClass}`}>
                                        {item.title}
                                    </div>
                                    <div className="mt-0.5 text-center text-[11px] text-muted-foreground">
                                        {item.content}
                                    </div>
                                </div>
                            );
                        })}
                    </motion.div>

                    {/* 点击层覆盖整个立方体区域 */}
                    <button
                        type="button"
                        onClick={handleClick}
                        className="absolute inset-0 z-20 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`切换公告，当前：${current.title}`}
                    />
                </div>
            )}

            <div className="font-mono text-[10px] text-muted-foreground">
                点击立方体切下一面 · {index + 1}/{MOCK_ANNOUNCEMENTS.length}
            </div>
        </div>
    );
}
