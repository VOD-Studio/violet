/**
 * MotdTerminal - 原型 ⑧：MOTD 终端
 *
 * 模拟服务器开机时打印的系统消息（Message of the Day）。
 * 多条公告各占一行，形如 [info] 文本 / [warn] 文本 / [ok] 文本 / [error] 文本。
 * severity 映射为日志标签 + 配色。底部带闪烁光标 █。
 *
 * 不用轮播（多行平铺），无自动动画，天然合规 WCAG。
 * 用 useRotation 只为追踪「当前激活行」（高亮），不驱动自动切换。
 */

import { MOCK_ANNOUNCEMENTS, SEVERITY_CONFIG } from "./types";
import { useRotation } from "./use-rotation";

export function MotdTerminal() {
    const { index, onHoverStart, onHoverEnd, onWheel } = useRotation(
        MOCK_ANNOUNCEMENTS,
        999999, // 不自动推进，只用 hover/wheel 控制「激活行」
    );

    return (
        <div
            className="flex h-full w-full flex-col rounded-lg border border-edge-hairline bg-zinc-950 p-4 font-mono text-xs"
            onMouseEnter={onHoverStart}
            onMouseLeave={onHoverEnd}
            onWheel={onWheel}
        >
            {/* 终端标题栏 */}
            <div className="mb-3 flex items-center gap-1.5 border-b border-edge-hairline pb-2 text-zinc-500">
                <span className="h-2 w-2 rounded-full bg-red-500/70" />
                <span className="h-2 w-2 rounded-full bg-amber-500/70" />
                <span className="h-2 w-2 rounded-full bg-emerald-500/70" />
                <span className="ml-2 text-[10px]">mimo-blog :: motd</span>
            </div>

            {/* boot log */}
            <div className="mb-2 text-zinc-500">
                <span className="text-emerald-500">[boot]</span> establishing session... ok
            </div>

            {/* 公告行 */}
            <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto">
                {MOCK_ANNOUNCEMENTS.map((item, i) => {
                    const cfg = SEVERITY_CONFIG[item.severity];
                    const isActive = i === index;
                    return (
                        <div
                            key={item.id}
                            className={`flex items-start gap-2 rounded px-1.5 py-1 transition-colors ${
                                isActive ? "bg-white/5" : ""
                            }`}
                        >
                            <span className={`shrink-0 ${cfg.textClass}`}>[{cfg.label}]</span>
                            <span className="text-zinc-300">{item.content}</span>
                        </div>
                    );
                })}
            </div>

            {/* 底部光标 */}
            <div className="mt-2 flex items-center gap-1 text-zinc-500">
                <span className="text-[10px]">↑↓ scroll · {index + 1} active</span>
                <span className="ml-auto inline-block h-3 w-2 animate-pulse bg-emerald-400/80" />
            </div>
        </div>
    );
}
