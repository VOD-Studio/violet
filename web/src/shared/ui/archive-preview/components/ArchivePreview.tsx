/**
 * 压缩包预览主组件（fflate）
 *
 * 功能：
 * - ZIP 解压并列出内部文件树（目录可折叠）
 * - 文件数与解压后总大小统计
 * - 加载/错误状态 + 重试
 * - RAR/7z/tar.gz 等不支持前端解压的格式：提示需下载
 * - 下载原始压缩包
 */

import { AlertCircle, Download, FileArchive, RotateCcw } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/shared/ui/button";
import { useArchive } from "../hooks/useArchive";
import type { ArchivePreviewProps } from "../types/archive-preview-types";
import { formatSize } from "../utils/format";
import { ArchiveTree } from "./ArchiveTree";

export function ArchivePreview({ url, name, mimeType, className }: ArchivePreviewProps) {
    const { entries, loadStatus, unsupported, retry } = useArchive({ url, name, mimeType });

    const stats = useMemo(() => {
        const files = entries.filter((e) => !e.isDirectory);
        const totalSize = files.reduce((sum, f) => sum + f.size, 0);
        return { count: files.length, totalSize };
    }, [entries]);

    function handleDownload() {
        const a = document.createElement("a");
        a.href = url;
        a.download = name ?? "archive.zip";
        a.click();
    }

    return (
        <div
            className={`flex flex-col overflow-hidden rounded-lg border bg-background ${className ?? ""}`}
        >
            {/* 顶部操作条 */}
            <div className="flex items-center justify-between border-b px-3 py-1.5">
                <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    <FileArchive className="size-3.5 shrink-0" />
                    {name ?? "压缩包"}
                </span>
                <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={handleDownload}
                    title="下载"
                >
                    <Download className="size-3.5" />
                </Button>
            </div>

            {/* 内容区 */}
            <div className="max-h-[70vh] overflow-auto">
                {loadStatus === "loading" ? (
                    <div className="flex h-32 items-center justify-center">
                        <div className="size-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
                    </div>
                ) : unsupported ? (
                    <div className="flex h-40 flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
                        <FileArchive className="size-10 opacity-40" />
                        <div>
                            <p className="text-sm">该压缩格式暂不支持在线预览</p>
                            <p className="mt-1 text-xs">RAR/7z 等格式请下载后查看</p>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
                            <Download className="mr-1.5 size-3.5" />
                            下载文件
                        </Button>
                    </div>
                ) : loadStatus === "error" ? (
                    <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                        <AlertCircle className="size-8 text-red-500" />
                        <span className="text-sm">压缩包加载失败</span>
                        <Button type="button" variant="outline" size="sm" onClick={retry}>
                            <RotateCcw className="mr-1.5 size-3.5" />
                            重试
                        </Button>
                    </div>
                ) : entries.length === 0 ? (
                    <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
                        压缩包为空
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
                            <span>共 {stats.count} 个文件</span>
                            <span>解压后 {formatSize(stats.totalSize)}</span>
                        </div>
                        <ArchiveTree entries={entries} />
                    </>
                )}
            </div>
        </div>
    );
}
