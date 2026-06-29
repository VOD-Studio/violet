import { PageShell } from "@features/admin-layout/ui/PageShell";
import { ConfirmDialog } from "@features/admin-shared/ui/confirm-dialog";
import { adminFileKeys } from "@features/media/api/keys";
import { useAdminDeleteFile } from "@features/media/api/mutations";
import { useAdminMedia } from "@features/media/api/queries";
import type { AdminMediaListQuery, MediaFile } from "@features/media/model/types";
import { EditMediaDialog } from "@features/media/ui/EditMediaDialog";
import { MediaCoverDialog } from "@features/media/ui/MediaCoverDialog";
import { MediaGrid } from "@features/media/ui/MediaGrid";
import { MediaLightbox } from "@features/media/ui/MediaLightbox";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Images, Pencil, Search, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/dialog";
import { Segmented, viewTypeSegments } from "@/shared/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Uploader } from "@/shared/ui/uploader";

type ViewMode = "grid" | "table";

/**
 * /admin/media - 素材管理页
 *
 * 全局素材库：网格/表格双视图（Segmented 切换）、用途/类型筛选、搜索、
 * 上传（分片+进度）、灯箱预览、元数据编辑、删除。
 */
export const Route = createFileRoute("/admin/media")({
    component: AdminMediaPage,
});

function AdminMediaPage() {
    // 筛选状态
    const [purpose, setPurpose] = useState<string>("");
    const [fileType, setFileType] = useState<string>("");
    const [keyword, setKeyword] = useState<string>("");
    const [view, setView] = useState<ViewMode>("grid");

    // 弹窗状态
    const [uploadOpen, setUploadOpen] = useState(false);
    const [editFile, setEditFile] = useState<MediaFile | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [coverFile, setCoverFile] = useState<MediaFile | null>(null);
    const [coverOpen, setCoverOpen] = useState(false);
    const [deleteFile, setDeleteFile] = useState<MediaFile | null>(null);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [previewIndex, setPreviewIndex] = useState<number>(-1);

    // 查询参数
    const query: AdminMediaListQuery = {
        page: 1,
        limit: 60,
        purpose: purpose || undefined,
        type: fileType || undefined,
        keyword: keyword || undefined,
    };
    const { data, isLoading } = useAdminMedia(query);
    const deleteMutation = useAdminDeleteFile();
    const queryClient = useQueryClient();

    const files = data?.data ?? [];

    const handleEdit = (file: MediaFile) => {
        setEditFile(file);
        setEditOpen(true);
    };

    const handlePickCover = (file: MediaFile) => {
        setCoverFile(file);
        setCoverOpen(true);
    };

    const handleDelete = (file: MediaFile) => {
        setDeleteFile(file);
        setDeleteOpen(true);
    };

    const confirmDelete = () => {
        if (!deleteFile) return;
        deleteMutation.mutate(deleteFile.id, {
            onSuccess: () => {
                toast.success("已删除");
                setDeleteOpen(false);
                setDeleteFile(null);
            },
            onError: () => toast.error("删除失败"),
        });
    };

    const handlePreview = (file: MediaFile) => {
        const idx = files.findIndex((f) => f.id === file.id);
        setPreviewIndex(idx);
    };

    return (
        <PageShell
            title="素材管理"
            description="管理系统媒体文件"
            action={
                <Button size="sm" onClick={() => setUploadOpen(true)}>
                    <Upload className="size-3.5" />
                    上传素材
                </Button>
            }
        >
            {/* 工具栏：筛选 + 搜索 + 视图切换 */}
            <div className="flex flex-wrap items-center gap-2">
                <Select
                    value={purpose || "all"}
                    onValueChange={(v) => setPurpose(v === "all" ? "" : v)}
                >
                    <SelectTrigger className="h-8 w-[120px] text-xs">
                        <SelectValue placeholder="用途" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">全部用途</SelectItem>
                        <SelectItem value="material">素材</SelectItem>
                        <SelectItem value="avatar">头像</SelectItem>
                        <SelectItem value="post">文章配图</SelectItem>
                        <SelectItem value="emoji">表情</SelectItem>
                    </SelectContent>
                </Select>

                <Select
                    value={fileType || "all"}
                    onValueChange={(v) => setFileType(v === "all" ? "" : v)}
                >
                    <SelectTrigger className="h-8 w-[120px] text-xs">
                        <SelectValue placeholder="类型" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">全部类型</SelectItem>
                        <SelectItem value="image">图片</SelectItem>
                        <SelectItem value="video">视频</SelectItem>
                        <SelectItem value="audio">音频</SelectItem>
                    </SelectContent>
                </Select>

                <div className="relative flex-1">
                    <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="搜索文件名…"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        className="h-8 pl-7 text-xs"
                    />
                </div>

                <Segmented
                    value={view}
                    onValueChange={(v) => setView(v as ViewMode)}
                    segments={viewTypeSegments()}
                />
            </div>

            {/* 内容区 */}
            {isLoading ? (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                    加载中…
                </div>
            ) : files.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Images className="size-8 opacity-40" />
                    <p className="text-sm">暂无素材，点击上方按钮上传</p>
                </div>
            ) : view === "grid" ? (
                <MediaGrid
                    files={files}
                    onPreview={handlePreview}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onPickCover={handlePickCover}
                />
            ) : (
                <MediaTable
                    files={files}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onPreview={handlePreview}
                />
            )}

            {/* 上传弹窗 */}
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>上传素材</DialogTitle>
                        <DialogDescription>支持拖拽多文件，分片上传含进度</DialogDescription>
                    </DialogHeader>
                    <Uploader
                        purpose="material"
                        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.md"
                        maxSize={1024 * 1024 * 1024}
                        maxFiles={10}
                        label="拖拽文件到此处或点击上传"
                        hint="支持图片、视频、音频、文档，单文件最大 1GB"
                        onUploaded={() => {
                            // 上传成功后刷新素材列表
                            queryClient.invalidateQueries({
                                queryKey: adminFileKeys.lists(),
                            });
                        }}
                    />
                </DialogContent>
            </Dialog>

            {/* 编辑弹窗 */}
            <EditMediaDialog open={editOpen} onOpenChange={setEditOpen} file={editFile} />

            {/* 视频选帧设封面弹窗 */}
            <MediaCoverDialog open={coverOpen} onOpenChange={setCoverOpen} file={coverFile} />

            {/* 删除确认 */}
            <ConfirmDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title="删除素材"
                description={`确定删除「${deleteFile?.original_name ?? ""}」吗？此操作不可恢复。`}
                confirmLabel="删除"
                loading={deleteMutation.isPending}
                onConfirm={confirmDelete}
            />

            {/* 灯箱预览 */}
            <MediaLightbox
                open={previewIndex >= 0}
                onOpenChange={(o) => !o && setPreviewIndex(-1)}
                files={files}
                index={Math.max(0, previewIndex)}
                onIndexChange={setPreviewIndex}
            />
        </PageShell>
    );
}

/**
 * MediaTable - 简易表格视图
 *
 * 复用 DataTable 需较多 columns 配置，这里先用轻量手写表格保证可用，
 * 后续可迁移到 admin-shared 的 DataTable 套件。
 */
function MediaTable({
    files,
    onEdit,
    onDelete,
    onPreview,
}: {
    files: MediaFile[];
    onEdit?: (file: MediaFile) => void;
    onDelete?: (file: MediaFile) => void;
    onPreview?: (file: MediaFile) => void;
}) {
    return (
        <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                        <th className="px-3 py-2 text-left font-medium">预览</th>
                        <th className="px-3 py-2 text-left font-medium">文件名</th>
                        <th className="px-3 py-2 text-left font-medium">类型</th>
                        <th className="px-3 py-2 text-left font-medium">大小</th>
                        <th className="px-3 py-2 text-left font-medium">用途</th>
                        <th className="px-3 py-2 text-left font-medium">分类</th>
                        <th className="px-3 py-2 text-left font-medium">创建时间</th>
                        <th className="px-3 py-2 text-center font-medium">操作</th>
                    </tr>
                </thead>
                <tbody>
                    {files.map((file) => (
                        <tr key={file.id} className="border-t hover:bg-muted/30">
                            <td className="px-3 py-2">
                                <button
                                    type="button"
                                    onClick={() => onPreview?.(file)}
                                    className="block size-10 overflow-hidden rounded bg-muted"
                                >
                                    {file.mime_type.startsWith("image/") ? (
                                        <img
                                            src={file.thumbnail || file.url}
                                            alt=""
                                            className="size-full object-cover"
                                        />
                                    ) : file.mime_type.startsWith("video/") && file.thumbnail ? (
                                        <img
                                            // 用 updated_at 破缓存，与 MediaGrid 一致
                                            src={`${file.thumbnail}?v=${encodeURIComponent(file.updated_at ?? file.created_at)}`}
                                            alt=""
                                            className="size-full object-cover"
                                        />
                                    ) : (
                                        <span className="flex size-full items-center justify-center text-[10px] text-muted-foreground">
                                            {file.mime_type.split("/")[0]?.slice(0, 4)}
                                        </span>
                                    )}
                                </button>
                            </td>
                            <td
                                className="max-w-[180px] truncate px-3 py-2"
                                title={file.original_name}
                            >
                                {file.original_name}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                                {file.mime_type}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                                {(file.size / 1024).toFixed(1)} KB
                            </td>
                            <td className="px-3 py-2 text-xs">{file.purpose}</td>
                            <td className="px-3 py-2 text-xs">{file.category || "-"}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                                {new Date(file.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-3 py-2">
                                <div className="flex justify-center gap-1">
                                    {onEdit ? (
                                        <Button
                                            size="icon-sm"
                                            variant="ghost"
                                            onClick={() => onEdit(file)}
                                        >
                                            <Pencil className="size-3.5" />
                                        </Button>
                                    ) : null}
                                    {onDelete ? (
                                        <Button
                                            size="icon-sm"
                                            variant="ghost"
                                            className="hover:bg-destructive/10 hover:text-destructive"
                                            onClick={() => onDelete(file)}
                                        >
                                            <Trash2 className="size-3.5" />
                                        </Button>
                                    ) : null}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
