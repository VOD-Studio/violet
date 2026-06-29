/**
 * PDF 工具栏
 *
 * 包含：上一页/页码/下一页、缩放（- / 比例 / + / 重置）、下载。
 */

import { ChevronLeft, ChevronRight, Download, Maximize, Minus, Plus } from "lucide-react";
import { Button } from "@/shared/ui/button";

interface PdfToolbarProps {
    currentPage: number;
    numPages: number;
    scale: number;
    onPrevPage: () => void;
    onNextPage: () => void;
    onGoToPage: (page: number) => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onResetZoom: () => void;
    onDownload: () => void;
}

export function PdfToolbar({
    currentPage,
    numPages,
    scale,
    onPrevPage,
    onNextPage,
    onGoToPage,
    onZoomIn,
    onZoomOut,
    onResetZoom,
    onDownload,
}: PdfToolbarProps) {
    return (
        <div className="flex items-center gap-1 border-b px-2 py-1.5">
            {/* 页码导航 */}
            <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={onPrevPage}
                disabled={currentPage <= 1}
                title="上一页"
            >
                <ChevronLeft className="size-4" />
            </Button>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <input
                    type="number"
                    min={1}
                    max={numPages || 1}
                    value={currentPage}
                    onChange={(e) => onGoToPage(Number(e.target.value))}
                    className="h-6 w-10 rounded border bg-background px-1 text-center text-xs tabular-nums"
                    aria-label="当前页码"
                />
                <span>/ {numPages || "-"}</span>
            </div>
            <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={onNextPage}
                disabled={currentPage >= numPages}
                title="下一页"
            >
                <ChevronRight className="size-4" />
            </Button>

            <div className="mx-1 h-4 w-px bg-border" />

            {/* 缩放 */}
            <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={onZoomOut}
                disabled={scale <= 0.5}
                title="缩小"
            >
                <Minus className="size-4" />
            </Button>
            <button
                type="button"
                onClick={onResetZoom}
                className="min-w-12 rounded px-1 py-0.5 text-center text-xs tabular-nums hover:bg-muted"
                title="重置缩放"
            >
                {Math.round(scale * 100)}%
            </button>
            <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={onZoomIn}
                disabled={scale >= 3}
                title="放大"
            >
                <Plus className="size-4" />
            </Button>
            <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={onResetZoom}
                title="实际大小"
            >
                <Maximize className="size-4" />
            </Button>

            <div className="flex-1" />

            {/* 下载 */}
            <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={onDownload}
                title="下载 PDF"
            >
                <Download className="size-4" />
            </Button>
        </div>
    );
}
