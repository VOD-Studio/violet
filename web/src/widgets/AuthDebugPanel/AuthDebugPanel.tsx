import { notifySessionExpired } from "@shared/api/auth-gate";
import { useSessionStore } from "@shared/api/session";
import { triggerProactiveRefreshNow } from "@shared/api/token-scheduler";
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import { Bug, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * AuthDebugPanel - 鉴权链路验证面板（仅 DEV）
 *
 * 验证鉴权降级链路，无需等待 access token 自然过期：
 *
 * 1. 触发主动刷新
 *    立即执行 doRefresh（绕过定时器等待）：
 *    - refresh token 有效 → 静默续期，Network 显示 200
 *    - refresh token 失效（删 Redis refresh key）→ 401 → 清会话 + 弹登录窗 + Header 翻「登录」
 *
 * 2. 模拟会话失效
 *    直接调 notifySessionExpired，验证 opener 注入链路：
 *    清 sessionActive + 弹窗（不清 me 缓存，与主动刷新失败略有差异）
 *
 * 验证 refresh 401 场景：docker exec blog-redis redis-cli DEL 'refresh:<userId>'
 *
 * 仅 import.meta.env.DEV 渲染，生产构建会被 tree-shaking 移除。
 */
const AuthDebugPanel = () => {
    const [expanded, setExpanded] = useState(false);
    const sessionActive = useSessionStore((s) => s.sessionActive);

    const handleTriggerRefresh = () => {
        toast.info("已触发主动刷新，观察 Network 面板 /auth/refresh");
        triggerProactiveRefreshNow();
    };

    const handleSimulateExpired = () => {
        toast.info("已直接触发会话失效通知，应弹出登录窗");
        notifySessionExpired();
    };

    return (
        <div className="fixed left-4 bottom-4 z-100 w-72 rounded-lg border border-edge-hairline bg-background/95 shadow-lg backdrop-blur-md">
            <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="flex w-full items-center justify-between px-3 py-2"
            >
                <span className="flex items-center gap-2 text-sm font-medium">
                    <Bug className="size-4" />
                    Auth Debug
                </span>
                {expanded ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
            </button>

            {expanded && (
                <div className="flex flex-col gap-2 border-t border-edge-hairline px-3 py-3">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">会话状态</span>
                        <Badge variant={sessionActive ? "default" : "outline"}>
                            {sessionActive ? "active" : "inactive"}
                        </Badge>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-center text-xs"
                        onClick={handleTriggerRefresh}
                    >
                        触发主动刷新（看 refresh 结果）
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-center text-xs"
                        onClick={handleSimulateExpired}
                    >
                        模拟会话失效（直接弹窗）
                    </Button>

                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                        验证 refresh 401：先 docker exec blog-redis redis-cli DEL
                        'refresh:&lt;userId&gt;'，再点上方按钮。
                    </p>
                </div>
            )}
        </div>
    );
};

/**
 * 仅 DEV 环境渲染 DebugPanel，生产构建返回 null
 */
export const AuthDebugPanelDev = () => {
    if (!import.meta.env.DEV) return null;
    return <AuthDebugPanel />;
};
