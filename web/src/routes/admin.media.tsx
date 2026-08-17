import type { MediaFile } from "@entities/media/model/types";
import { PageShell } from "@features/admin-layout/ui/PageShell";
import { adminMediaKeys } from "@features/admin-media/api/keys";
import { useAdminDeleteFile, useBatchDeleteMedia } from "@features/admin-media/api/mutations";
import { useAdminMedia } from "@features/admin-media/api/queries";
import type { AdminMediaListQuery } from "@features/admin-media/model/types";
import { EditMediaDialog } from "@features/admin-media/ui/EditMediaDialog";
import { MediaCoverDialog } from "@features/admin-media/ui/MediaCoverDialog";
import { MediaGrid } from "@features/admin-media/ui/MediaGrid";
import { MediaLightbox } from "@features/admin-media/ui/MediaLightbox";
import {
	DataTable,
	type DataTableColumn,
	DEFAULT_PAGE_SIZE,
} from "@features/admin-shared/ui/data-table";
import { Pagination } from "@features/admin-shared/ui/data-table/components/Pagination";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { useReplaceMediaFile } from "@features/upload/api/mutations";
import { useChunkedUpload } from "@features/upload/hooks/use-chunked-upload";
import type { CropRect } from "@features/upload/lib/crop-image";
import { cropImageToBlob } from "@features/upload/lib/crop-image";
import { Uploader } from "@features/upload/ui/Uploader";
import { withCrop } from "@shared/lib/crop-url";
import { Button } from "@shared/ui/base/button";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { ImageCropper } from "@shared/ui/image-cropper/ImageCropper";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Images, Pencil, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/ui/base/select";
import { Modal } from "@/shared/ui/modal";
import { SearchInput } from "@/shared/ui/search-input";
import { Segmented, viewTypeSegments } from "@/shared/ui/segmented";

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
	const [page, setPage] = useState(1);
	const pageSize = DEFAULT_PAGE_SIZE;

	// 弹窗状态
	const [uploadOpen, setUploadOpen] = useState(false);
	const [editFile, setEditFile] = useState<MediaFile | null>(null);
	const [editOpen, setEditOpen] = useState(false);
	const [coverFile, setCoverFile] = useState<MediaFile | null>(null);
	const [coverOpen, setCoverOpen] = useState(false);
	const [cropFile, setCropFile] = useState<MediaFile | null>(null);
	const [cropOpen, setCropOpen] = useState(false);
	const [cropRect, setCropRect] = useState<CropRect | undefined>(undefined);
	const [overwrite, setOverwrite] = useState(false);
	const replaceMedia = useReplaceMediaFile();
	const [deleteFile, setDeleteFile] = useState<MediaFile | null>(null);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [previewIndex, setPreviewIndex] = useState<number>(-1);

	const canUpload = useHasPermission("media:upload");
	const canDeleteMedia = useHasPermission("media:delete");
	// 图片预览的触发元素，用于从卡片位置展开动画
	const [previewTrigger, setPreviewTrigger] = useState<HTMLElement | null>(null);

	// 查询参数
	const query: AdminMediaListQuery = {
		page,
		limit: pageSize,
		purpose: purpose || undefined,
		type: fileType || undefined,
		keyword: keyword || undefined,
	};
	const { data, isLoading } = useAdminMedia(query);
	const deleteMutation = useAdminDeleteFile();
	const batchDeleteMutation = useBatchDeleteMedia();
	const queryClient = useQueryClient();

	const files = data?.data ?? [];
	const total = data?.pagination?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	const handleBatchDelete = () => {
		if (selectedIds.size === 0) return;
		batchDeleteMutation.mutate(Array.from(selectedIds), {
			onSuccess: (res) => {
				toast.success(`已删除 ${res.deleted} 个素材`);
				setBatchDeleteOpen(false);
				setSelectedIds(new Set());
			},
			onError: () => toast.error("批量删除失败"),
		});
	};

	const handleEdit = (file: MediaFile) => {
		setEditFile(file);
		setEditOpen(true);
	};

	const handlePickCover = (file: MediaFile) => {
		setCoverFile(file);
		setCoverOpen(true);
	};

	const { uploadFile } = useChunkedUpload({ purpose: "material" });

	const handleCrop = (file: MediaFile) => {
		setCropFile(file);
		setCropRect(undefined);
		setOverwrite(false);
		setCropOpen(true);
	};

	const handleCropConfirm = async () => {
		if (!cropFile || !cropRect) return;
		const isGif = cropFile.mime_type.includes("gif");
		try {
			if (isGif) {
				// GIF:不重编码(保留动画),把 ?crop 坐标拼到 URL 复制给用户
				const url = withCrop(cropFile.url, cropRect);
				try {
					await navigator.clipboard.writeText(url);
					toast.success("已复制裁剪后 URL(GIF 保留动画)");
				} catch {
					// clipboard 不可用时降级:toast 显示 URL 供手动复制
					toast(url, { description: "剪贴板不可用,请手动复制此 URL" });
				}
				setCropOpen(false);
				return;
			}
			const blob = await cropImageToBlob(cropFile.url, cropRect);
			const name = cropFile.original_name.replace(/\.[^.]+$/, "") || "cropped";
			const file = new File([blob], `${name}.webp`, { type: "image/webp" });
			if (overwrite) {
				// 覆盖原图:走 replace 接口,file_id 不变,指针指向裁剪后文件
				await replaceMedia.mutateAsync({ fileId: cropFile.id, file });
				toast.success("已覆盖原图");
			} else {
				// 新建:走标准上传产生新素材记录
				await uploadFile(file);
				toast.success("已上传裁剪后的新素材");
			}
			queryClient.invalidateQueries({ queryKey: adminMediaKeys.lists() });
			setCropOpen(false);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "裁剪失败");
		}
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

	const handlePreview = (file: MediaFile, trigger?: HTMLElement | null) => {
		const idx = files.findIndex((f) => f.id === file.id);
		setPreviewIndex(idx);
		setPreviewTrigger(trigger ?? null);
	};

	return (
		<PageShell
			title="素材管理"
			description="管理系统媒体文件"
			action={
				canUpload ? (
					<Button size="sm" onClick={() => setUploadOpen(true)}>
						<Upload className="size-3.5" />
						上传素材
					</Button>
				) : null
			}
			sticky={
				<div className="flex flex-wrap items-center gap-3 pt-1">
					<Select
						value={purpose || "all"}
						onValueChange={(v) => {
							setPurpose(v === "all" ? "" : v);
							setPage(1);
						}}
					>
						<SelectTrigger className="h-9 w-30 text-xs">
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
						onValueChange={(v) => {
							setFileType(v === "all" ? "" : v);
							setPage(1);
						}}
					>
						<SelectTrigger className="h-9 w-30 text-xs">
							<SelectValue placeholder="类型" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">全部类型</SelectItem>
							<SelectItem value="image">图片</SelectItem>
							<SelectItem value="video">视频</SelectItem>
							<SelectItem value="audio">音频</SelectItem>
						</SelectContent>
					</Select>

					<div className="min-w-40 max-w-72 flex-1">
						<SearchInput
							size="sm"
							defaultValue=""
							placeholder="搜索文件名…"
							onSearch={(v) => {
								setKeyword(v);
								setPage(1);
							}}
						/>
					</div>

					<Segmented
						value={view}
						onValueChange={(v) => setView(v as ViewMode)}
						segments={viewTypeSegments()}
						size="default"
					/>
				</div>
			}
		>
			{/* 内容区 */}
			{isLoading ? (
				<div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
					加载中…
				</div>
			) : files.length === 0 ? (
				<div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
					<Images className="size-8 opacity-40" />
					<p className="text-sm">暂无素材</p>
				</div>
			) : view === "grid" ? (
				<MediaGrid
					files={files}
					onPreview={handlePreview}
					onEdit={canUpload ? handleEdit : undefined}
					onDelete={canDeleteMedia ? handleDelete : undefined}
					onPickCover={canUpload ? handlePickCover : undefined}
					onCrop={canUpload ? handleCrop : undefined}
				/>
			) : (
				<MediaTable
					files={files}
					selectedIds={selectedIds}
					onSelectionChange={setSelectedIds}
					onEdit={canUpload ? handleEdit : undefined}
					onDelete={canDeleteMedia ? handleDelete : undefined}
					onPreview={handlePreview}
					onBatchDelete={canDeleteMedia ? () => setBatchDeleteOpen(true) : undefined}
					batchDeleting={batchDeleteMutation.isPending}
				/>
			)}

			{/* 分页 */}
			{files.length > 0 ? (
				<Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
			) : null}

			{/* 上传弹窗 */}
			<Modal
				open={uploadOpen}
				onOpenChange={setUploadOpen}
				title="上传素材"
				description="支持拖拽多文件，分片上传含进度"
				size="md"
				footer={null}
			>
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
							queryKey: adminMediaKeys.lists(),
						});
					}}
				/>
			</Modal>

			{/* 编辑弹窗 */}
			<EditMediaDialog open={editOpen} onOpenChange={setEditOpen} file={editFile} />

			{/* 视频选帧设封面弹窗 */}
			<MediaCoverDialog open={coverOpen} onOpenChange={setCoverOpen} file={coverFile} />

			{/* 图片裁剪弹窗 */}
			<Modal
				open={cropOpen}
				onOpenChange={setCropOpen}
				title={cropFile ? `裁剪「${cropFile.original_name}」` : "裁剪"}
				size="md"
				footer={
					<div className="flex items-center justify-between">
						{cropFile && !cropFile.mime_type.includes("gif") ? (
							<label className="flex cursor-pointer items-center gap-2 text-sm">
								<input
									type="checkbox"
									checked={overwrite}
									onChange={(e) => setOverwrite(e.target.checked)}
									className="size-4"
								/>
								覆盖原图
							</label>
						) : (
							<span />
						)}
						<div className="flex gap-2">
							<Button
								variant="ghost"
								onClick={() => setCropOpen(false)}
								disabled={replaceMedia.isPending}
							>
								取消
							</Button>
							{cropRect && (
								<Button
									variant="ghost"
									onClick={() => setCropRect(undefined)}
									disabled={replaceMedia.isPending}
								>
									清除选区
								</Button>
							)}
							<Button
								onClick={handleCropConfirm}
								disabled={!cropRect || replaceMedia.isPending}
							>
								{replaceMedia.isPending
									? "处理中..."
									: overwrite
										? "确认覆盖"
										: "确认上传"}
							</Button>
						</div>
					</div>
				}
			>
				{cropFile ? (
					<ImageCropper
						src={cropFile.url}
						aspect={undefined}
						rect={cropRect}
						onChange={setCropRect}
					/>
				) : null}
			</Modal>

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

			{/* 批量删除确认 */}
			<ConfirmDialog
				open={batchDeleteOpen}
				onOpenChange={setBatchDeleteOpen}
				title="批量删除素材"
				description={`确定删除选中的 ${selectedIds.size} 个素材吗？此操作不可恢复。`}
				confirmLabel="删除"
				loading={batchDeleteMutation.isPending}
				onConfirm={handleBatchDelete}
			/>

			{/* 灯箱预览 */}
			<MediaLightbox
				open={previewIndex >= 0}
				onOpenChange={(o) => {
					if (!o) {
						setPreviewIndex(-1);
						setPreviewTrigger(null);
					}
				}}
				files={files}
				index={Math.max(0, previewIndex)}
				onIndexChange={setPreviewIndex}
				triggerElement={previewTrigger}
			/>
		</PageShell>
	);
}

/**
 * MediaTable - 素材表格视图
 *
 * 复用 admin-shared 的 DataTable，统一复选框、列宽持久化、空态等交互规范。
 */
function MediaTable({
	files,
	selectedIds,
	onSelectionChange,
	onEdit,
	onDelete,
	onPreview,
	onBatchDelete,
	batchDeleting,
}: {
	files: MediaFile[];
	selectedIds: Set<string>;
	onSelectionChange: (ids: Set<string>) => void;
	onEdit?: (file: MediaFile) => void;
	onDelete?: (file: MediaFile) => void;
	onPreview?: (file: MediaFile, trigger?: HTMLElement | null) => void;
	onBatchDelete?: () => void;
	batchDeleting: boolean;
}) {
	const columns: DataTableColumn<MediaFile>[] = [
		{
			key: "preview",
			header: "预览",
			width: "72px",
			cell: (file) => (
				<button
					type="button"
					onClick={(e) => onPreview?.(file, e.currentTarget)}
					className="block size-10 overflow-hidden rounded bg-muted"
				>
					{file.mime_type.startsWith("image/") ? (
						<img
							src={file.thumbnail || file.url}
							alt=""
							className="size-full object-cover"
							// 缩略图失效时隐藏，父按钮的灰底块自然兜底
							onError={(e) => {
								e.currentTarget.style.display = "none";
							}}
						/>
					) : file.mime_type.startsWith("video/") && file.thumbnail ? (
						<img
							// 用 updated_at 破缓存，与 MediaGrid 一致
							src={`${file.thumbnail}?v=${encodeURIComponent(file.updated_at ?? file.created_at)}`}
							alt=""
							className="size-full object-cover"
							onError={(e) => {
								e.currentTarget.style.display = "none";
							}}
						/>
					) : (
						<span className="flex size-full items-center justify-center text-[10px] text-muted-foreground">
							{file.mime_type.split("/")[0]?.slice(0, 4)}
						</span>
					)}
				</button>
			),
		},
		{
			key: "original_name",
			header: "文件名",
			hideable: false,
			accessorKey: "original_name",
			ellipsis: true,
		},
		{
			key: "mime_type",
			header: "类型",
			width: "120px",
			accessorKey: "mime_type",
			ellipsis: true,
		},
		{
			key: "size",
			header: "大小",
			width: "80px",
			cell: (file) => (
				<span className="text-xs text-muted-foreground">
					{(file.size / 1024).toFixed(1)} KB
				</span>
			),
		},
		{
			key: "purpose",
			header: "用途",
			width: "80px",
			accessorKey: "purpose",
		},
		{
			key: "category",
			header: "分类",
			width: "80px",
			cell: (file) => file.category || "-",
		},
		{
			key: "created_at",
			header: "创建时间",
			width: "120px",
			cell: (file) => (
				<span className="text-xs text-muted-foreground">
					{new Date(file.created_at).toLocaleDateString()}
				</span>
			),
		},
		{
			key: "actions_col",
			header: "操作",
			sticky: "right",
			width: "96px",
			align: "center",
			cell: (file) => (
				<div className="flex justify-center gap-1">
					{onEdit ? (
						<Button size="icon-sm" variant="ghost" onClick={() => onEdit(file)}>
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
			),
		},
	];

	return (
		<DataTable<MediaFile>
			data={files}
			columns={columns}
			keyExtractor={(file) => file.id}
			selectable
			selectedIds={selectedIds}
			onSelectionChange={onSelectionChange}
			bulkActions={
				onBatchDelete ? (
					<Button
						size="sm"
						variant="destructive"
						onClick={onBatchDelete}
						disabled={batchDeleting}
					>
						<Trash2 className="size-3.5" />
						删除
					</Button>
				) : null
			}
			loading={false}
			storageKey="admin-media-table-columns"
			caption="素材列表"
			emptyTitle="暂无素材"
			emptyDescription="当前筛选条件下没有素材"
		/>
	);
}
