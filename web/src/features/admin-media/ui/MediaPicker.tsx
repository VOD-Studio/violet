/**
 * MediaPicker - 素材库选择器
 *
 * 弹窗式素材选择：网格浏览、用途/类型筛选、搜索、分页。
 * 支持单选（封面/图片插入）与多选（多图插入）。
 * 底部确认按钮回传选中 MediaFile[]。
 *
 * 通过 mediaType 限定可选素材类型（如封面图只选 image）。
 */

import type { MediaFile, MediaType } from "@entities/media/model/types";
import { Pagination } from "@features/admin-shared/ui/data-table/components/Pagination";
import { Check, FileText, Film, Music } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { imageUrl } from "@shared/lib/image-url";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/base/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/base/select";
import { Modal } from "@/shared/ui/modal";
import { SearchInput } from "@/shared/ui/search-input";
import { useAdminMedia } from "../api/queries";
import type { AdminMediaListQuery } from "../model/types";

export interface MediaPickerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** 选择确认回调 */
    onConfirm: (files: MediaFile[]) => void;
    /** 是否允许多选，默认 false（单选：选完即确认） */
    multiple?: boolean;
    /** 标题 */
    title?: string;
    /** 限定可选素材类型；如封面图传 "image" 则只显示图片且隐藏类型筛选 */
    mediaType?: MediaType;
}

const PAGE_SIZE = 40;

export function MediaPicker({
    open,
    onOpenChange,
    onConfirm,
    multiple = false,
    title = "选择素材",
    mediaType,
}: MediaPickerProps) {
    // 用 "all" 作为「全部」占位值（Radix Select 不支持空字符串 value）
    const [purpose, setPurpose] = useState("all");
    const [fileType, setFileType] = useState<string>(mediaType ?? "all");
    const [keyword, setKeyword] = useState("");
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState<MediaFile[]>([]);

    // 打开时重置选择与筛选；mediaType 变化时同步
    useEffect(() => {
        if (open) {
            setSelected([]);
            setPage(1);
            setFileType(mediaType ?? "all");
        }
    }, [open, mediaType]);

    const query: AdminMediaListQuery = useMemo(
        () => ({
            page,
            limit: PAGE_SIZE,
            purpose: purpose === "all" ? undefined : purpose,
            type: fileType === "all" ? undefined : fileType,
            keyword: keyword || undefined,
        }),
        [page, purpose, fileType, keyword],
    );

    const { data, isLoading } = useAdminMedia(query);
    const files = data?.data ?? [];
    const total = data?.pagination?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const toggle = (file: MediaFile) => {
        if (multiple) {
            setSelected((prev) =>
                prev.some((f) => f.id === file.id)
                    ? prev.filter((f) => f.id !== file.id)
                    : [...prev, file],
            );
        } else {
            // 单选直接确认
            onConfirm([file]);
            onOpenChange(false);
        }
    };

    const handleConfirm = () => {
        onConfirm(selected);
        onOpenChange(false);
    };

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title={title}
            size="xl"
            footer={
                <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                        {multiple ? `已选 ${selected.length} 个` : "点击素材直接选择"}
                    </span>
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => onOpenChange(false)}>
                            取消
                        </Button>
                        {multiple ? (
                            <Button onClick={handleConfirm} disabled={selected.length === 0}>
                                确认选择
                            </Button>
                        ) : null}
                    </div>
                </div>
            }
        >
            {/* 筛选栏 */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
                <Select
                    value={purpose}
                    onValueChange={(v) => {
                        setPurpose(v);
                        setPage(1);
                    }}
                >
                    <SelectTrigger className="w-32" onPointerDown={(e) => e.stopPropagation()}>
                        <SelectValue placeholder="用途" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">全部用途</SelectItem>
                        <SelectItem value="material">素材</SelectItem>
                        <SelectItem value="cover">封面</SelectItem>
                        <SelectItem value="avatar">头像</SelectItem>
                        <SelectItem value="post">文章</SelectItem>
                    </SelectContent>
                </Select>
                {/* mediaType 限定时不显示类型选择器 */}
                {!mediaType ? (
                    <Select
                        value={fileType}
                        onValueChange={(v) => {
                            setFileType(v);
                            setPage(1);
                        }}
                    >
                        <SelectTrigger className="w-32" onPointerDown={(e) => e.stopPropagation()}>
                            <SelectValue placeholder="类型" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">全部类型</SelectItem>
                            <SelectItem value="image">图片</SelectItem>
                            <SelectItem value="video">视频</SelectItem>
                            <SelectItem value="audio">音频</SelectItem>
                            <SelectItem value="file">文件</SelectItem>
                        </SelectContent>
                    </Select>
                ) : null}
                <SearchInput
                    defaultValue={keyword}
                    onSearch={(v) => {
                        setKeyword(v);
                        setPage(1);
                    }}
                    placeholder="搜索文件名…"
                    className="max-w-64 flex-1"
                />
            </div>

            {/* 网格 */}
            <div className="min-h-60">
                {isLoading ? (
                    <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
                        加载中…
                    </div>
                ) : files.length === 0 ? (
                    <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
                        暂无素材
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                        {files.map((file) => {
                            const isSel = selected.some((f) => f.id === file.id);
                            return (
                                <button
                                    type="button"
                                    key={file.id}
                                    onClick={() => toggle(file)}
                                    className={cn(
                                        "group relative aspect-square overflow-hidden rounded-lg border bg-muted transition-all",
                                        isSel
                                            ? "border-primary ring-2 ring-primary"
                                            : "border-edge-hairline hover:border-primary/50",
                                    )}
                                >
                                    <MediaThumb file={file} />
                                    {isSel ? (
                                        <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                            <Check className="size-3" />
                                        </span>
                                    ) : null}
                                    <span className="absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-black/70 to-transparent px-2 py-1 text-left text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                                        {file.original_name}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 分页 */}
            {totalPages > 1 ? (
                <div className="mt-4">
                    <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                </div>
            ) : null}
        </Modal>
    );
}

/** 媒体缩略图：图片用缩略图，其他类型显示对应图标 */
function MediaThumb({ file }: { file: MediaFile }) {
    const isImage = file.mime_type.startsWith("image/");
    const isVideo = file.mime_type.startsWith("video/");
    const isAudio = file.mime_type.startsWith("audio/");

    if (isImage) {
        const thumb = file.thumbnail || imageUrl(file.url, { thumb: "300x300", format: "webp" });
        return (
            <img
                src={thumb}
                alt={file.alt_text || file.original_name}
                loading="lazy"
                className="size-full object-cover"
            />
        );
    }
    const Icon = isVideo ? Film : isAudio ? Music : FileText;
    return (
        <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <Icon className="size-8" />
            <span className="px-1 text-[10px]">{file.original_name}</span>
        </div>
    );
}
