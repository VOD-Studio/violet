/**
 * 音频加载/错误遮罩
 *
 * 覆盖波形区域的三种状态：加载中、加载失败（含重试）。
 */

import { AlertCircle, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/shared/ui/base/button";
import type { AudioLoadStatus } from "../types/audio-preview-types";

interface AudioOverlayProps {
    loadStatus: AudioLoadStatus;
    onRetry: () => void;
}

export function AudioOverlay({ loadStatus, onRetry }: AudioOverlayProps) {
    // 加载中
    if (loadStatus === "loading") {
        return (
            <div className="flex h-20 items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span className="text-xs">加载音频中…</span>
            </div>
        );
    }

    // 加载失败
    if (loadStatus === "error") {
        return (
            <div className="flex h-20 flex-col items-center justify-center gap-2 text-muted-foreground">
                <div className="flex items-center gap-1.5 text-red-500">
                    <AlertCircle className="size-4" />
                    <span className="text-xs">音频加载失败</span>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                    <RotateCcw className="mr-1.5 size-3" />
                    重试
                </Button>
            </div>
        );
    }

    return null;
}
