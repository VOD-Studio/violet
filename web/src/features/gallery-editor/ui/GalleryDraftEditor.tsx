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
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { MediaFile } from "@entities/media/model/types";
import { MediaPicker } from "@entities/media/ui/MediaPicker";
import { PageShell } from "@features/admin-layout/ui/PageShell";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { useGalleryDraftDocument } from "@features/gallery-editor/hooks/useGalleryDraftDocument";
import {
	appendMediaFiles,
	appendUploadedFile,
	MAX_GALLERY_ITEMS,
	moveGalleryItem,
	moveGalleryItemById,
} from "@features/gallery-editor/model/draft";
import type { CompleteUploadResult } from "@features/upload/model/types";
import { Uploader } from "@features/upload/ui/Uploader";
import { Button } from "@shared/ui/base/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/base/card";
import { Input } from "@shared/ui/base/input";
import { Label } from "@shared/ui/base/label";
import { Textarea } from "@shared/ui/base/textarea";
import { AlertTriangle, ImagePlus, Loader2, RefreshCw, Save } from "lucide-react";
import { useState } from "react";
import { GalleryDraftPreview } from "./GalleryDraftPreview";
import { GalleryItemEditor } from "./GalleryItemEditor";
import { GallerySaveIndicator } from "./GallerySaveIndicator";

interface GalleryDraftEditorProps {
	id: string;
}

/** 图集工作稿编辑器：本地即时编辑，防抖与显式保存共用完整 PUT。 */
export function GalleryDraftEditor({ id }: GalleryDraftEditorProps) {
	const canManage = useHasPermission("gallery:manage");
	const { draft, isLoading, error, saveState, updateDraft, save, reload } =
		useGalleryDraftDocument({ id, canManage });
	const [pickerOpen, setPickerOpen] = useState(false);
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	const addMediaFiles = (files: MediaFile[]) => {
		updateDraft((current) => ({ ...current, items: appendMediaFiles(current.items, files) }));
		setPickerOpen(false);
	};

	const addUploadedFile = (file: CompleteUploadResult, source: File) => {
		updateDraft((current) => ({
			...current,
			items: appendUploadedFile(current.items, file, source.type),
		}));
	};

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;
		updateDraft((current) => ({
			...current,
			items: moveGalleryItemById(current.items, String(active.id), String(over.id)),
		}));
	};

	if (error && !draft) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-3">
				<p className="text-sm text-destructive">{error.message}</p>
				<Button variant="outline" onClick={() => void reload()}>
					<RefreshCw className="size-4" />
					重试
				</Button>
			</div>
		);
	}

	if (isLoading || !draft) {
		return (
			<div className="flex h-full items-center justify-center text-muted-foreground">
				<Loader2 className="mr-2 size-5 animate-spin" />
				正在载入工作稿
			</div>
		);
	}

	const disabled = !canManage || saveState === "conflict";

	return (
		<PageShell
			title="图集工作稿"
			description={`工作稿 · ${draft.items.length}/${MAX_GALLERY_ITEMS} 张图片`}
			action={
				<>
					<GallerySaveIndicator state={saveState} />
					<Button
						size="sm"
						disabled={disabled || saveState === "saving"}
						onClick={() => void save(true)}
					>
						{saveState === "saving" ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Save className="size-4" />
						)}
						保存工作稿
					</Button>
				</>
			}
		>
			{saveState === "conflict" ? (
				<div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-start gap-2 text-sm">
						<AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
						<p>服务器上的工作稿已更新。为避免覆盖他人的修改，请重新载入最新版本。</p>
					</div>
					<Button variant="outline" size="sm" onClick={() => void reload()}>
						<RefreshCw className="size-4" />
						重新载入
					</Button>
				</div>
			) : null}

			<div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
				<div className="min-w-0 space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>基本信息</CardTitle>
						</CardHeader>
						<CardContent className="space-y-5">
							<div className="space-y-2">
								<div className="flex items-center justify-between gap-4">
									<Label htmlFor="gallery-title">标题</Label>
									<span className="text-xs tabular-nums text-muted-foreground">
										{draft.title.length}/120
									</span>
								</div>
								<Input
									id="gallery-title"
									value={draft.title}
									maxLength={120}
									disabled={disabled}
									placeholder="未命名图集"
									onChange={(event) =>
										updateDraft((current) => ({
											...current,
											title: event.target.value,
										}))
									}
								/>
							</div>
							<div className="space-y-2">
								<div className="flex items-center justify-between gap-4">
									<Label htmlFor="gallery-summary">摘要</Label>
									<span className="text-xs tabular-nums text-muted-foreground">
										{draft.summary.length}/500
									</span>
								</div>
								<Textarea
									id="gallery-summary"
									value={draft.summary}
									maxLength={500}
									disabled={disabled}
									placeholder="可选，写一段图集简介"
									onChange={(event) =>
										updateDraft((current) => ({
											...current,
											summary: event.target.value,
										}))
									}
								/>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>图片</CardTitle>
						</CardHeader>
						<CardContent className="space-y-5">
							<div className="flex flex-wrap items-center gap-2">
								<Button
									type="button"
									variant="outline"
									disabled={disabled || draft.items.length >= MAX_GALLERY_ITEMS}
									onClick={() => setPickerOpen(true)}
								>
									<ImagePlus className="size-4" />
									从素材库选择
								</Button>
								<span className="text-xs text-muted-foreground">
									首张图片自动作为封面
								</span>
							</div>

							{!disabled && draft.items.length < MAX_GALLERY_ITEMS ? (
								<Uploader<CompleteUploadResult>
									purpose="material"
									accept="image/*"
									maxFiles={MAX_GALLERY_ITEMS - draft.items.length}
									label="上传图片并加入工作稿"
									hint="支持拖拽或多选；上传完成后会自动加入末尾"
									onUploaded={addUploadedFile}
								/>
							) : null}

							<DndContext
								sensors={sensors}
								collisionDetection={closestCenter}
								onDragEnd={handleDragEnd}
							>
								<SortableContext
									items={draft.items.map((item) => item.file_id)}
									strategy={verticalListSortingStrategy}
								>
									<div className="space-y-3">
										{draft.items.map((item, index) => (
											<GalleryItemEditor
												key={item.file_id}
												item={item}
												index={index}
												total={draft.items.length}
												disabled={disabled}
												onChange={(patch) =>
													updateDraft((current) => ({
														...current,
														items: current.items.map((candidate) =>
															candidate.file_id === item.file_id
																? { ...candidate, ...patch }
																: candidate,
														),
													}))
												}
												onMove={(to) =>
													updateDraft((current) => ({
														...current,
														items: moveGalleryItem(
															current.items,
															index,
															to,
														),
													}))
												}
												onRemove={() =>
													updateDraft((current) => ({
														...current,
														items: current.items.filter(
															(candidate) =>
																candidate.file_id !== item.file_id,
														),
													}))
												}
											/>
										))}
									</div>
								</SortableContext>
							</DndContext>
						</CardContent>
					</Card>
				</div>

				<aside className="sticky top-0 min-w-0">
					<Card>
						<CardHeader>
							<CardTitle>工作稿预览</CardTitle>
						</CardHeader>
						<CardContent>
							<GalleryDraftPreview {...draft} />
						</CardContent>
					</Card>
				</aside>
			</div>

			<MediaPicker
				open={pickerOpen}
				onOpenChange={setPickerOpen}
				onConfirm={addMediaFiles}
				multiple
				mediaType="image"
				source="owned"
				title="选择图集图片"
			/>
		</PageShell>
	);
}
