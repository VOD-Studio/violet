/**
 * Docx 加载/错误遮罩
 */

import { AlertCircle, FileText, RotateCcw } from "lucide-react";
import { Button } from "@/shared/ui/base/button";
import type { DocxLoadStatus } from "../types/docx-preview-types";

interface DocxOverlayProps {
    loadStatus: DocxLoadStatus;
    onRetry: () => void;
}

export function DocxOverlay({ loadStatus, onRetry }: DocxOverlayProps) {
    if (loadStatus === "loading") {
        return (
            <div className="flex h-60 flex-col items-center justify-center gap-2 text-muted-foreground">
                <FileText className="size-10 opacity-40" />
                <div className="size-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
                <span className="text-xs">正在解析文档…</span>
            </div>
        );
    }

    if (loadStatus === "error") {
        return (
            <div className="flex h-60 flex-col items-center justify-center gap-3 text-muted-foreground">
                <AlertCircle className="size-10 text-red-500" />
                <p className="text-sm">文档加载失败</p>
                <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                    <RotateCcw className="mr-1.5 size-3.5" />
                    重试
                </Button>
            </div>
        );
    }

    return null;
}
