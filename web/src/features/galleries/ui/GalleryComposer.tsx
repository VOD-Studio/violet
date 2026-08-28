import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	rectSortingStrategy,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { MediaFile } from "@entities/media/model/types";
import { useChunkedUpload } from "@features/upload/hooks/use-chunked-upload";
import { ApiError } from "@shared/api/error";
import { useNavigate } from "@tanstack/react-router";
import {
	AlertCircle,
	Film,
	GripVertical,
	ImagePlus,
	Loader2,
	Save,
	Star,
	Upload,
	X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/base/button";
import { Input } from "@/shared/ui/base/input";
import { Textarea } from "@/shared/ui/base/textarea";
import { useCreateGallery, useUpdateGallery } from "../api/mutations";
import { GALLERY_MEDIA_ACCEPT, isGalleryMediaType } from "../lib/media";
import {
	GALLERY_CAPTION_MAX,
	GALLERY_DESCRIPTION_MAX,
	GALLERY_ITEMS_MAX,
	GALLERY_TITLE_MAX,
	type GalleryDetail,
	type GalleryItemInput,
} from "../model/types";
import { MediaPoolPicker } from "./MediaPoolPicker";

/** 图片 10MB（对齐通用 Uploader 默认）；视频分片上传放宽到 200MB */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

type ItemStatus = "ready" | "uploading" | "error";

interface ComposerItem {
	/** 稳定 key：素材/已有项用 f-{fileId}，上传项用 u-{自增} */
	key: string;
	/** 上传完成后才有；uploading/error 态为空串 */
	fileId: string;
	caption: string;
	/** 本地预览地址（上传中的 blob）；已就绪项为空串 */
	previewUrl: string;
	/** 后端生成的缩略图（图片缩略档 / 视频首帧）；无则空串，视频项无缩略图时只能渲染占位 */
	thumbnail: string;
	isVideo: boolean;
	status: ItemStatus;
	/** 0-100，仅 uploading 态有意义 */
	progress: number;
}
/** 建/编图集编辑器入参：mode 决定提交走 POST /galleries 还是 PATCH items 全量替换。 */
export interface GalleryComposerProps {
	mode: "create" | "edit";
	/** 编辑模式的已有图集（回填 title/description/items） */
	gallery?: GalleryDetail;
}

/** rune 计数（按 Unicode 码点，对齐后端 utf8.RuneCountInString） */
const runeCount = (s: string) => [...s].length;

/** 媒体卡展示地址：图片优先缩略图回退本地预览；视频只有首帧缩略图可渲染，缺失交给占位 */
const displaySrc = (item: ComposerItem) =>
	item.isVideo ? item.thumbnail : item.thumbnail || item.previewUrl;
/**
 * 建/编图集编辑器：标题/描述 + 有序媒体网格（素材池选取、现场上传、
 * 拖拽排序、caption 行内编辑、设为封面）。提交即 items 全量替换，URL 不变。
 */
export function GalleryComposer({ mode, gallery }: GalleryComposerProps) {
	const navigate = useNavigate();
	const [title, setTitle] = useState(gallery?.title ?? "");
	const [description, setDescription] = useState(gallery?.description ?? "");
	const [items, setItems] = useState<ComposerItem[]>(() =>
		(gallery?.items ?? []).map((it) => ({
			key: `f-${it.file_id}`,
			fileId: it.file_id,
			caption: it.caption,
			previewUrl: "",
			thumbnail: it.thumbnail,
			isVideo: it.mime_type.startsWith("video/"),
			status: "ready" as const,
			progress: 100,
		})),
	);
	// 本会话设置的封面项；null = 不提交 cover 字段（后端维持原状，未设封面时取首项）
	const [coverFileId, setCoverFileId] = useState<string | null>(null);
	const [pickerOpen, setPickerOpen] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const uploadKeyRef = useRef(0);

	const createGallery = useCreateGallery();
	const updateGallery = useUpdateGallery(gallery?.id ?? "");
	const { uploadFile } = useChunkedUpload({ purpose: "material" });

	const titleCount = runeCount(title);
	const titleOver = title.trim().length === 0 || titleCount > GALLERY_TITLE_MAX;
	const descriptionOver = runeCount(description) > GALLERY_DESCRIPTION_MAX;
	const uploading = items.some((i) => i.status === "uploading");
	// 上传失败项必须显式移除后才能提交：静默丢弃会让用户误以为全部媒体已进图集
	const failedCount = items.filter((i) => i.status === "error").length;
	const readyItems = items.filter((i) => i.status === "ready" && i.fileId);
	const captionOver = items.some((i) => runeCount(i.caption) > GALLERY_CAPTION_MAX);
	const canSubmit =
		(mode === "create" ? !createGallery.isPending : !updateGallery.isPending) &&
		!uploading &&
		failedCount === 0 &&
		!titleOver &&
		!descriptionOver &&
		!captionOver &&
		readyItems.length >= 1;

	const patchItem = (key: string, updates: Partial<ComposerItem>) => {
		setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...updates } : i)));
	};

	/** 素材池确认 → 追加到末尾（额度/去重已在 picker 内约束，这里兜底再滤一次） */
	const addFromPool = (files: MediaFile[]) => {
		setItems((prev) => {
			const seen = new Set(prev.map((i) => i.fileId).filter(Boolean));
			const slots = GALLERY_ITEMS_MAX - prev.length;
			const fresh = files
				.filter((f) => !seen.has(f.id) && isGalleryMediaType(f.mime_type))
				.slice(0, Math.max(0, slots))
				.map<ComposerItem>((f) => ({
					key: `f-${f.id}`,
					fileId: f.id,
					caption: "",
					previewUrl: "",
					thumbnail: f.thumbnail,
					isVideo: f.mime_type.startsWith("video/"),
					status: "ready",
					progress: 100,
				}));
			if (fresh.length < files.length) {
				toast.error(`部分素材未添加：超出 ${GALLERY_ITEMS_MAX} 项上限或类型不支持`);
			}
			return [...prev, ...fresh];
		});
	};

	/** 选择文件 → 逐个上传（顺序，避免并发挤占分片通道；对齐 TweetComposer 模式） */
	const handleFiles = async (files: FileList | null) => {
		if (!files || files.length === 0) return;
		const slots = GALLERY_ITEMS_MAX - items.length;
		if (slots <= 0) {
			toast.error(`图集最多 ${GALLERY_ITEMS_MAX} 项`);
			return;
		}
		if (files.length > slots) {
			toast.error(`最多还能添加 ${slots} 项，已添加前 ${slots} 个`);
		}
		const picked = Array.from(files).slice(0, slots);
		for (const file of picked) {
			if (!isGalleryMediaType(file.type)) {
				toast.error(`${file.name} 不是图片或 mp4/webm 视频`);
				continue;
			}
			const maxBytes = file.type.startsWith("video/") ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
			if (file.size > maxBytes) {
				toast.error(`${file.name} 超过 ${maxBytes / 1024 / 1024}MB`);
				continue;
			}
			const key = `u-${++uploadKeyRef.current}`;
			setItems((prev) => [
				...prev,
				{
					key,
					fileId: "",
					caption: "",
					// 视频的本地 blob 无法当图片渲染，预览留空交给占位
					previewUrl: file.type.startsWith("video/") ? "" : URL.createObjectURL(file),
					thumbnail: "",
					isVideo: file.type.startsWith("video/"),
					status: "uploading",
					progress: 0,
				},
			]);
			try {
				const res = await uploadFile(file, (p) => patchItem(key, { progress: p.percent }));
				patchItem(key, {
					status: "ready",
					fileId: res.file_id,
					thumbnail: res.thumbnail ?? "",
				});
			} catch (err) {
				patchItem(key, { status: "error" });
				toast.error(err instanceof ApiError ? err.message : `${file.name} 上传失败`);
			}
		}
		// 清空 input value 以便重复选择同一文件
		if (inputRef.current) inputRef.current.value = "";
	};

	/** 删除项若正被设为封面，同步清空封面指向，避免提交指向不存在媒体项的 cover_file_id */
	const removeItem = (key: string) => {
		const target = items.find((i) => i.key === key);
		if (target?.fileId && target.fileId === coverFileId) setCoverFileId(null);
		setItems((prev) => prev.filter((i) => i.key !== key));
	};

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;
		setItems((prev) => {
			const from = prev.findIndex((i) => i.key === active.id);
			const to = prev.findIndex((i) => i.key === over.id);
			return from < 0 || to < 0 ? prev : arrayMove(prev, from, to);
		});
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (uploading) {
			toast.error("还有媒体在上传中");
			return;
		}
		if (failedCount > 0) {
			toast.error(`有 ${failedCount} 项媒体上传失败，请移除后重试`);
			return;
		}
		if (title.trim().length === 0) {
			toast.error("标题不能为空");
			return;
		}
		if (titleCount > GALLERY_TITLE_MAX) {
			toast.error(`标题不能超过 ${GALLERY_TITLE_MAX} 字`);
			return;
		}
		if (descriptionOver) {
			toast.error(`描述不能超过 ${GALLERY_DESCRIPTION_MAX} 字`);
			return;
		}
		if (captionOver) {
			toast.error(`图片说明不能超过 ${GALLERY_CAPTION_MAX} 字`);
			return;
		}
		if (readyItems.length === 0) {
			toast.error("至少添加一项媒体");
			return;
		}
		// items 全量替换：数组顺序即展示顺序，caption 提交 trim
		const itemInputs: GalleryItemInput[] = readyItems.map((i) => ({
			file_id: i.fileId,
			caption: i.caption.trim(),
		}));
		// cover 只在本会话设置过才提交；null 省略字段 = 后端维持原封面（未设时取首项）
		const payload = {
			title: title.trim(),
			description: description.trim(),
			...(coverFileId ? { cover_file_id: coverFileId } : {}),
		};

		if (mode === "create") {
			createGallery.mutate(
				{ ...payload, items: itemInputs },
				{
					onSuccess: (detail) => {
						toast.success("图集已发布");
						// T3 详情页落地前先落在编辑页，URL 稳定且可继续补充
						navigate({ to: "/galleries/$id/edit", params: { id: detail.id } });
					},
					onError: (err) =>
						toast.error(err instanceof ApiError ? err.message : "发布失败"),
				},
			);
		} else if (gallery) {
			updateGallery.mutate(
				{ ...payload, items: itemInputs },
				{
					onSuccess: () => toast.success("已保存"),
					onError: (err) =>
						toast.error(err instanceof ApiError ? err.message : "保存失败"),
				},
			);
		}
	};

	const isPending = mode === "create" ? createGallery.isPending : updateGallery.isPending;

	return (
		<form onSubmit={handleSubmit} aria-label={mode === "create" ? "创建图集" : "编辑图集"}>
			{/* 标题 + 描述 */}
			<div className="space-y-4">
				<div>
					<Input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="图集标题（必填）"
						maxLength={GALLERY_TITLE_MAX * 2}
						aria-label="图集标题"
					/>
					<div className="mt-1 flex justify-end">
						<span
							className={cn(
								"text-xs",
								titleCount > GALLERY_TITLE_MAX
									? "font-medium text-destructive"
									: "text-muted-foreground",
							)}
						>
							{titleCount}/{GALLERY_TITLE_MAX}
						</span>
					</div>
				</div>
				<div>
					<Textarea
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						placeholder="图集描述（可选）"
						rows={3}
						aria-label="图集描述"
					/>
					<div className="mt-1 flex justify-end">
						<span
							className={cn(
								"text-xs",
								descriptionOver
									? "font-medium text-destructive"
									: "text-muted-foreground",
							)}
						>
							{runeCount(description)}/{GALLERY_DESCRIPTION_MAX}
						</span>
					</div>
				</div>
			</div>

			{/* 进图通道 */}
			<div className="mt-6 flex flex-wrap items-center gap-2 border-t border-edge-hairline pt-4">
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => setPickerOpen(true)}
				>
					<ImagePlus className="size-4" />
					从素材库选择
				</Button>
				<input
					ref={inputRef}
					type="file"
					accept={GALLERY_MEDIA_ACCEPT}
					multiple
					className="hidden"
					onChange={(e) => handleFiles(e.target.files)}
				/>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => inputRef.current?.click()}
					disabled={uploading || items.length >= GALLERY_ITEMS_MAX}
				>
					<Upload className="size-4" />
					上传媒体
				</Button>
				<span className="ml-auto text-xs text-muted-foreground">
					{items.length}/{GALLERY_ITEMS_MAX} 项 · 拖动卡片调整顺序
				</span>
			</div>

			{/* 媒体网格 */}
			<div className="mt-4">
				{items.length === 0 ? (
					<div className="flex h-40 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-edge-hairline text-sm text-muted-foreground">
						<p>还没有媒体</p>
						<p className="text-xs">从素材库选择，或直接上传图片 / mp4 / webm</p>
					</div>
				) : (
					<DndContext
						sensors={sensors}
						collisionDetection={closestCenter}
						onDragEnd={handleDragEnd}
					>
						<SortableContext
							items={items.map((i) => i.key)}
							strategy={rectSortingStrategy}
						>
							<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
								{items.map((item) => (
									<SortableMediaCard
										key={item.key}
										item={item}
										isCover={!!item.fileId && item.fileId === coverFileId}
										onToggleCover={() =>
											setCoverFileId((prev) =>
												prev === item.fileId ? null : item.fileId,
											)
										}
										onCaptionChange={(caption) =>
											patchItem(item.key, { caption })
										}
										onRemove={() => removeItem(item.key)}
									/>
								))}
							</div>
						</SortableContext>
					</DndContext>
				)}
			</div>

			{/* 提交 */}
			<div className="mt-6 flex items-center justify-end border-t border-edge-hairline pt-4">
				<Button type="submit" disabled={!canSubmit}>
					{isPending ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Save className="size-4" />
					)}
					{mode === "create" ? "发布图集" : "保存修改"}
				</Button>
			</div>

			<MediaPoolPicker
				open={pickerOpen}
				onOpenChange={setPickerOpen}
				remaining={GALLERY_ITEMS_MAX - items.length}
				excludeIds={new Set(items.map((i) => i.fileId).filter(Boolean))}
				onConfirm={addFromPool}
			/>
		</form>
	);
}

export default GalleryComposer;

interface SortableMediaCardProps {
	item: ComposerItem;
	/** 是否为本会话设置的封面项 */
	isCover: boolean;
	onToggleCover: () => void;
	onCaptionChange: (caption: string) => void;
	onRemove: () => void;
}

/** 网格内可拖拽媒体卡：预览 + 句柄 + 删除 + 封面标记 + caption 行内编辑 */
function SortableMediaCard({
	item,
	isCover,
	onToggleCover,
	onCaptionChange,
	onRemove,
}: SortableMediaCardProps) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: item.key,
	});
	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.4 : 1,
	};
	const overCaption = runeCount(item.caption) > GALLERY_CAPTION_MAX;
	const src = displaySrc(item);

	return (
		<div
			ref={setNodeRef}
			style={style}
			className="group flex flex-col overflow-hidden rounded-xl border border-edge-hairline bg-surface/40"
		>
			<div className="relative aspect-square bg-muted">
				{src ? (
					<img src={src} alt="" className="size-full object-cover" draggable={false} />
				) : (
					// 视频项无首帧缩略图（或上传中）：源文件交给 <img> 只会破图，用占位
					<div className="flex size-full items-center justify-center text-muted-foreground">
						<Film className="size-8" />
					</div>
				)}
				{/* 拖拽句柄：hover 浮现，caption 输入不受拖拽影响 */}
				<button
					type="button"
					className="absolute left-1.5 top-1.5 cursor-grab touch-none rounded-md bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/70 focus-visible:opacity-100 active:cursor-grabbing"
					aria-label="拖拽排序"
					{...attributes}
					{...listeners}
				>
					<GripVertical className="size-3.5" />
				</button>
				<button
					type="button"
					onClick={onRemove}
					aria-label="移除媒体"
					className="absolute right-1.5 top-1.5 inline-flex size-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
				>
					<X className="size-3" />
				</button>
				{item.status === "ready" && (
					<button
						type="button"
						onClick={onToggleCover}
						aria-label={isCover ? "取消封面" : "设为封面"}
						aria-pressed={isCover}
						className={cn(
							"absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] transition-colors",
							isCover
								? "bg-primary text-primary-foreground"
								: "bg-black/60 text-white opacity-0 hover:bg-black/80 group-hover:opacity-100 focus-visible:opacity-100",
						)}
					>
						<Star className={cn("size-3", isCover && "fill-current")} />
						{isCover ? "封面" : "设为封面"}
					</button>
				)}
				{item.status === "uploading" && (
					<div className="absolute inset-x-0 bottom-0 h-1 bg-secondary">
						<div
							className="h-full bg-primary transition-[width]"
							style={{ width: `${item.progress}%` }}
						/>
					</div>
				)}
				{item.status === "error" && (
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-destructive/80 text-white">
						<AlertCircle className="size-4" />
						<span className="text-[10px]">上传失败</span>
					</div>
				)}
			</div>
			<div className="p-2">
				<input
					value={item.caption}
					onChange={(e) => onCaptionChange(e.target.value)}
					placeholder="说明（可选）"
					aria-label="图片说明"
					className={cn(
						"h-7 w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground",
						overCaption && "text-destructive",
					)}
					title={overCaption ? `说明不能超过 ${GALLERY_CAPTION_MAX} 字` : undefined}
				/>
			</div>
		</div>
	);
}
