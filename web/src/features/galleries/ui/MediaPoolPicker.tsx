import type { MediaFile } from "@entities/media/model/types";
import { useMediaList } from "@features/media/api/queries";
import { contentImageUrl } from "@shared/lib/image-url";
import { Check, Film } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/base/button";
import { Modal } from "@/shared/ui/modal";
import { isGalleryMediaType } from "../lib/media";
import { GALLERY_ITEMS_MAX } from "../model/types";

const PAGE_SIZE = 40;
/** 素材池多选弹窗入参；remaining/excludeIds 由 Composer 按当前 items 计算。 */
export interface MediaPoolPickerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** 还能追加多少项（GALLERY_ITEMS_MAX - 当前项数） */
	remaining: number;
	/** 已在图集中的 file id（禁选，防重复追加） */
	excludeIds: ReadonlySet<string>;
	/** 确认选择，回传追加的素材 */
	onConfirm: (files: MediaFile[]) => void;
}

/**
 * 当前用户素材池选择器（GET /media，purpose=material）：弹窗网格多选，
 * 回传选中 MediaFile[] 供 Composer 追加为图集项；类型白名单外的素材禁选。
 */
export function MediaPoolPicker({
	open,
	onOpenChange,
	remaining,
	excludeIds,
	onConfirm,
}: MediaPoolPickerProps) {
	const [page, setPage] = useState(1);
	const [selected, setSelected] = useState<MediaFile[]>([]);

	useEffect(() => {
		if (open) {
			setSelected([]);
			setPage(1);
		}
	}, [open]);

	const { data, isLoading, isError } = useMediaList({
		page,
		limit: PAGE_SIZE,
		purpose: "material",
	});
	const files = data?.data ?? [];
	const total = data?.pagination?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

	const toggle = (file: MediaFile) => {
		if (selected.some((f) => f.id === file.id)) {
			setSelected((prev) => prev.filter((f) => f.id !== file.id));
			return;
		}
		if (selected.length >= remaining) {
			toast.error(`图集最多 ${GALLERY_ITEMS_MAX} 项`);
			return;
		}
		setSelected((prev) => [...prev, file]);
	};

	const handleConfirm = () => {
		onConfirm(selected);
		onOpenChange(false);
	};
	const gridState = useMemo(() => {
		if (isLoading) return "loading" as const;
		if (isError) return "error" as const;
		if (files.length === 0) return "empty" as const;
		return "grid" as const;
	}, [isLoading, isError, files.length]);

	return (
		// size 对齐 admin MediaPicker 的素材网格档位
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title="从素材库选择"
			description="选取已有素材追加到图集末尾，之后可拖拽调整顺序"
			size="xl"
			footer={
				<div className="flex items-center justify-between">
					<span className="text-sm text-muted-foreground">
						{remaining > 0
							? `还可添加 ${remaining} 项`
							: `已达 ${GALLERY_ITEMS_MAX} 项上限`}
					</span>
					<div className="flex gap-2">
						<Button variant="ghost" onClick={() => onOpenChange(false)}>
							取消
						</Button>
						<Button onClick={handleConfirm} disabled={selected.length === 0}>
							确认添加{selected.length > 0 ? `（${selected.length}）` : ""}
						</Button>
					</div>
				</div>
			}
		>
			<div className="min-h-60">
				{gridState === "loading" ? (
					<div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
						加载中…
					</div>
				) : gridState === "error" ? (
					<div className="flex h-60 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
						<p>素材库加载失败</p>
						<p className="text-xs">请稍后重试</p>
					</div>
				) : gridState === "empty" ? (
					<div className="flex h-60 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
						<p>素材库还没有素材</p>
						<p className="text-xs">先在编辑器里上传，或回到图集编辑器直接上传媒体</p>
					</div>
				) : (
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
						{files.map((file) => {
							const isSel = selected.some((f) => f.id === file.id);
							const excluded = excludeIds.has(file.id);
							const wrongType = !isGalleryMediaType(file.mime_type);
							const disabled = excluded || wrongType;
							return (
								<button
									type="button"
									key={file.id}
									onClick={() => toggle(file)}
									disabled={disabled}
									title={
										excluded
											? "已在图集中"
											: wrongType
												? "图集仅支持图片和 mp4/webm 视频"
												: file.original_name
									}
									className={cn(
										"group relative aspect-square overflow-hidden rounded-lg border bg-muted transition-all",
										disabled && "cursor-not-allowed opacity-35",
										!disabled &&
											(isSel
												? "border-primary ring-2 ring-primary"
												: "border-edge-hairline hover:border-primary/50"),
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

			{totalPages > 1 ? (
				<div className="mt-4 flex items-center justify-between text-sm">
					<span className="text-muted-foreground">
						第 {page} / {totalPages} 页 · 共 {total} 项
					</span>
					<div className="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							disabled={page <= 1}
							onClick={() => setPage((p) => p - 1)}
						>
							上一页
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={page >= totalPages}
							onClick={() => setPage((p) => p + 1)}
						>
							下一页
						</Button>
					</div>
				</div>
			) : null}
		</Modal>
	);
}

/** 素材缩略图：图片用缩略图档，视频用 ffmpeg 首帧、缺失时回退图标 */
function MediaThumb({ file }: { file: MediaFile }) {
	if (!file.mime_type.startsWith("image/") && !file.thumbnail) {
		return (
			<div className="flex size-full items-center justify-center bg-secondary/60 text-muted-foreground">
				<Film className="size-8" />
			</div>
		);
	}
	return (
		<img
			src={file.thumbnail || contentImageUrl(file.url, { width: 300 })}
			alt={file.original_name}
			loading="lazy"
			className="size-full object-cover"
		/>
	);
}
