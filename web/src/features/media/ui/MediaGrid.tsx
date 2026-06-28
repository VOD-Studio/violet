import type { MediaFile } from "@features/media/model/types";
import type { LucideIcon } from "lucide-react";
import { FileText, Film, Music, Pencil, Trash2 } from "lucide-react";
import { imageUrl } from "@/features/upload/lib/imageUrl";
import { Button } from "@/shared/ui/button";

interface MediaGridProps {
    files: MediaFile[];
    onPreview?: (file: MediaFile) => void;
    onEdit?: (file: MediaFile) => void;
    onDelete?: (file: MediaFile) => void;
}

/**
 * MediaGrid - 素材网格视图
 *
 * 响应式网格，每个卡片展示缩略图 + 文件名 + 类型 badge + 大小 + 悬停操作。
 * 图片用缩略图（imageUrl 带 thumb 参数），非图片显示对应图标。
 */
export function MediaGrid({ files, onPreview, onEdit, onDelete }: MediaGridProps) {
    return (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {files.map((file) => (
                <MediaCard
                    key={file.id}
                    file={file}
                    onPreview={onPreview}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            ))}
        </div>
    );
}

function MediaCard({
    file,
    onPreview,
    onEdit,
    onDelete,
}: {
    file: MediaFile;
    onPreview?: (file: MediaFile) => void;
    onEdit?: (file: MediaFile) => void;
    onDelete?: (file: MediaFile) => void;
}) {
    const isImage = file.mime_type.startsWith("image/");
    const isVideo = file.mime_type.startsWith("video/");
    const isAudio = file.mime_type.startsWith("audio/");

    return (
        <div className="group relative overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md">
            {/* 缩略图区 */}
            <button
                type="button"
                onClick={() => onPreview?.(file)}
                className="flex aspect-square w-full items-center justify-center overflow-hidden bg-muted"
            >
                {isImage ? (
                    <img
                        src={imageUrl(file.url, { thumb: "300x300", format: "webp" })}
                        alt={file.alt_text || file.original_name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                ) : (
                    <FileIcon mime={file.mime_type} className="size-10 text-muted-foreground" />
                )}
            </button>

            {/* 信息区 */}
            <div className="space-y-1 p-2">
                <p className="truncate text-xs font-medium" title={file.original_name}>
                    {file.original_name}
                </p>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{formatSize(file.size)}</span>
                    <span className="capitalize">{getFileKind(isImage, isVideo, isAudio)}</span>
                </div>
            </div>

            {/* 悬停操作 */}
            <div className="absolute top-1 right-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                {onEdit ? (
                    <Button
                        size="icon-sm"
                        variant="secondary"
                        className="size-7 shadow-sm"
                        onClick={() => onEdit(file)}
                        title="编辑"
                    >
                        <Pencil className="size-3" />
                    </Button>
                ) : null}
                {onDelete ? (
                    <Button
                        size="icon-sm"
                        variant="secondary"
                        className="size-7 shadow-sm hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => onDelete(file)}
                        title="删除"
                    >
                        <Trash2 className="size-3" />
                    </Button>
                ) : null}
            </div>
        </div>
    );
}

/**
 * FileIcon - 根据文件类型显示图标
 */
function FileIcon({ mime, className }: { mime: string; className?: string }) {
    const Icon: LucideIcon = mime.startsWith("video/")
        ? Film
        : mime.startsWith("audio/")
          ? Music
          : FileText;
    return <Icon className={className} />;
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileKind(isImage: boolean, isVideo: boolean, isAudio: boolean): string {
    if (isImage) return "图片";
    if (isVideo) return "视频";
    if (isAudio) return "音频";
    return "文件";
}
