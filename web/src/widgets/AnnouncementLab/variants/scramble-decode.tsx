/**
 * ScrambleDecode - 原型 ⑨：Scramble 解码单条
 *
 * 单条显示，文字从乱码逐字解码到最终内容（电影黑客破解信息效果）。
 * 「下一条」按钮手动触发新一条重新解码——用户掌控节奏，天然合规 WCAG。
 *
 * 复用现有 react-bits DecryptedText（animateOn="view" + revealDirection="center"），
 * 无需引入新依赖。
 */
import DecryptedText from "@shared/vendor/react-bits/DecryptedText";
import { useState } from "react";
import { MOCK_ANNOUNCEMENTS, SEVERITY_CONFIG } from "./types";

export function ScrambleDecode() {
    const [index, setIndex] = useState(0);
    // key 用于强制 DecryptedText 重挂载 → 切换时重新触发解码
    const [nonce, setNonce] = useState(0);
    const item = MOCK_ANNOUNCEMENTS[index] ?? MOCK_ANNOUNCEMENTS[0];
    const cfg = SEVERITY_CONFIG[item.severity];

    const handleNext = () => {
        setIndex((i) => (i + 1) % MOCK_ANNOUNCEMENTS.length);
        setNonce((n) => n + 1);
    };

    return (
        <div
            className={`flex h-full w-full flex-col items-center justify-center gap-4 rounded-lg border ${cfg.borderClass} ${cfg.bgClass} p-6 font-mono`}
        >
            <div className={`text-xs uppercase tracking-widest ${cfg.textClass}`}>
                [{cfg.label}] · #{String(item.id).padStart(3, "0")}
            </div>

            <div className={`text-lg font-semibold ${cfg.textClass}`}>
                <DecryptedText
                    key={`${item.id}-${nonce}`}
                    text={item.title}
                    speed={40}
                    maxIterations={8}
                    sequential={true}
                    revealDirection="center"
                    animateOn="view"
                    characters="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*"
                />
            </div>

            <div className="max-w-md text-center text-sm text-muted-foreground">
                <DecryptedText
                    key={`${item.id}-content-${nonce}`}
                    text={item.content}
                    speed={25}
                    maxIterations={6}
                    sequential={true}
                    revealDirection="start"
                    animateOn="view"
                />
            </div>

            <button
                type="button"
                onClick={handleNext}
                className="mt-2 rounded border border-edge-hairline px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
                ▸ next message
            </button>
        </div>
    );
}
