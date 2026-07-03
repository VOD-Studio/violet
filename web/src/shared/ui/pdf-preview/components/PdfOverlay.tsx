/**
 * PDF 加载/错误遮罩
 */

import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/shared/ui/base/button";
import type { PdfLoadStatus } from "../types/pdf-preview-types";

interface PdfOverlayProps {
    loadStatus: PdfLoadStatus;
    onRetry: () => void;
}

export function PdfOverlay({ loadStatus, onRetry }: PdfOverlayProps) {
    if (loadStatus === "loading") {
        return (
            <div className="flex h-80 items-center justify-center">
                <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
            </div>
        );
    }

    if (loadStatus === "error") {
        return (
            <div className="flex h-80 flex-col items-center justify-center gap-3 text-muted-foreground">
                <AlertCircle className="size-10 text-red-500" />
                <p className="text-sm">PDF 加载失败</p>
                <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                    <RotateCcw className="mr-1.5 size-3.5" />
                    重试
                </Button>
            </div>
        );
    }

    return null;
}
