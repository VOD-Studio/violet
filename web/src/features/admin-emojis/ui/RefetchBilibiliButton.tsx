import { Button } from "@shared/ui/base/button";
import { PromptDialog } from "@shared/ui/prompt-dialog/PromptDialog";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { adminEmojiKeys } from "../api/keys";
import { useRefetchBilibiliEmojis } from "../api/mutations";
import { useBilibiliCookieDefault, useRefetchStatus } from "../api/queries";

/** RefetchBilibiliButton 重新拉取 B站表情按钮（弹窗输入 cookie、进度展示、完成刷新） */
export const RefetchBilibiliButton = () => {
    const qc = useQueryClient();
    const { data: status } = useRefetchStatus();
    const { data: cookieDefault } = useBilibiliCookieDefault();
    const refetch = useRefetchBilibiliEmojis();

    const [cookieOpen, setCookieOpen] = useState(false);
    const [cookieError, setCookieError] = useState("");

    const isRunning = status?.state === "running";
    const isFailed = status?.state === "failed";
    const isDone = status?.state === "done";

    // 失败时 toast（依赖 state 触发）
    useEffect(() => {
        if (isFailed && status?.error) {
            toast.error(`重新拉取失败: ${status.error}`);
        }
    }, [isFailed, status?.error]);

    // 完成时刷新分组列表 + toast
    useEffect(() => {
        if (isDone) {
            qc.invalidateQueries({ queryKey: adminEmojiKeys.adminGroupList() });
            toast.success("B站表情重新拉取完成");
        }
    }, [isDone, qc]);

    const handleClick = () => {
        setCookieError("");
        setCookieOpen(true);
    };

    const handleConfirm = (value: string) => {
        const cookie = value.trim();
        if (!cookie) {
            setCookieError("请输入 B站 Cookie");
            return false;
        }
        setCookieOpen(false);
        refetch.mutate(cookie, {
            onError: (err) => {
                const msg = err.message.includes("已有") ? "任务进行中，请等待" : err.message;
                toast.error(msg);
            },
        });
    };

    return (
        <>
            <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isRunning || refetch.isPending}
                onClick={handleClick}
            >
                {isRunning ? (
                    <Loader2 className="size-3.5 animate-spin" />
                ) : (
                    <RefreshCw className="size-3.5" />
                )}
                {isRunning
                    ? `拉取中 ${status?.groups_done ?? 0}/${status?.groups_total ?? 0}`
                    : "重新拉取"}
            </Button>
            <PromptDialog
                open={cookieOpen}
                onOpenChange={(open) => {
                    setCookieOpen(open);
                    if (!open) setCookieError("");
                }}
                title="重新拉取 B站表情"
                description="将按名称合并 B站表情，你的自定义分组和历史数据不受影响。已下架的 B站表情不会被删除。"
                label="B站 Cookie"
                defaultValue={cookieDefault?.cookie ?? ""}
                placeholder="粘贴完整 cookie 字符串，例如：buvid3=...; SESSDATA=...; bili_jct=..."
                multiline
                confirmLabel="确认拉取"
                error={cookieError}
                onValueChange={() => setCookieError("")}
                onConfirm={handleConfirm}
            />
        </>
    );
};
