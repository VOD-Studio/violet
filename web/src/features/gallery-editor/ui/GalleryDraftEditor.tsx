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
import { useMe } from "@features/auth/api/queries";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import {
	useDeleteGallery,
	usePublishGallery,
	useUnpublishGallery,
} from "@features/gallery-editor/api/mutations";
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
import { ApiError } from "@shared/api/error";
import { Button } from "@shared/ui/base/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/base/card";
import { Input } from "@shared/ui/base/input";
import { Label } from "@shared/ui/base/label";
import { Textarea } from "@shared/ui/base/textarea";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { Link, useNavigate } from "@tanstack/react-router";
import {
	AlertTriangle,
	ExternalLink,
	EyeOff,
	ImagePlus,
	Loader2,
	RefreshCw,
	Save,
	Send,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { GALLERY_STATUS_LABELS } from "../model/status";
import { GalleryDraftPreview } from "./GalleryDraftPreview";
import { GalleryItemEditor } from "./GalleryItemEditor";
import { GallerySaveIndicator } from "./GallerySaveIndicator";

interface GalleryDraftEditorProps {
	id: string;
}

/** 图集工作稿编辑器：本地即时编辑，防抖与显式保存共用完整 PUT。 */
export function GalleryDraftEditor({ id }: GalleryDraftEditorProps) {
	const navigate = useNavigate();
	const canManage = useHasPermission("gallery:manage");
	const canModerate = useHasPermission("gallery:moderate");
	const { data: me } = useMe();
	const {
		draft,
		detail,
		editable,
		version,
		isLoading,
		error,
		saveState,
		updateDraft,
		save,
		reload,
	} = useGalleryDraftDocument({ id, canManage, viewerId: me?.id });
	const publish = usePublishGallery(id);
	const unpublish = useUnpublishGallery(id);
	const remove = useDeleteGallery(id, detail?.slug ?? null);
	const [pickerOpen, setPickerOpen] = useState(false);
	const [confirmAction, setConfirmAction] = useState<"unpublish" | "delete" | null>(null);
	const [operationError, setOperationError] = useState<{
		kind: "validation" | "conflict";
		message: string;
	} | null>(null);
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

	const handlePublish = async () => {
		setOperationError(null);
		try {
			await publish.mutateAsync({ expected_version: actionVersion });
			toast.success(status === "modified" ? "公开版本已更新" : "图集已发布");
		} catch (publishFailure) {
			if (publishFailure instanceof ApiError && publishFailure.status === 409) {
				setOperationError({
					kind: "conflict",
					message: "工作稿已在其他窗口更新，请重新载入后再发布。",
				});
				return;
			}
			if (publishFailure instanceof ApiError && publishFailure.status === 400) {
				setOperationError({
					kind: "validation",
					message:
						publishFailure.message ||
						"图集尚不符合发布要求，请确认标题和图片内容完整后重试。",
				});
				return;
			}
			toast.error(publishFailure instanceof Error ? publishFailure.message : "发布失败");
		}
	};

	const handleUnpublish = async () => {
		setOperationError(null);
		try {
			await unpublish.mutateAsync({ expected_version: actionVersion });
			setConfirmAction(null);
			toast.success("图集已撤回，工作稿已保留");
		} catch (failure) {
			setConfirmAction(null);
			handleMaintenanceFailure(failure, "撤回失败");
		}
	};

	const handleDelete = async () => {
		setOperationError(null);
		try {
			await remove.mutateAsync({ expected_version: actionVersion });
			setConfirmAction(null);
			toast.success("图集已永久删除");
			await navigate({ to: "/admin/galleries" });
		} catch (failure) {
			setConfirmAction(null);
			handleMaintenanceFailure(failure, "删除失败");
		}
	};

	const handleMaintenanceFailure = (failure: unknown, fallback: string) => {
		if (failure instanceof ApiError && failure.status === 409) {
			setOperationError({
				kind: "conflict",
				message: "图集已在其他窗口更新，请重新载入后再操作。",
			});
			return;
		}
		toast.error(failure instanceof Error ? failure.message : fallback);
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

	const status = detail?.status ?? "draft";
	const publicSlug = detail?.slug;
	const actionVersion = Math.max(version, detail?.version ?? 0);
	// 所有权与权限双轨:改稿(保存/发布)只有持有 gallery:manage 的作者本人可用;
	// 撤回/删除还开放给 gallery:moderate 审核员处置他人作品
	const canEdit = editable;
	const canMaintain = canEdit || canModerate;
	const maintenancePending = publish.isPending || unpublish.isPending || remove.isPending;
	const disabled = !canEdit || saveState === "conflict" || maintenancePending;
	const maintenanceDisabled =
		!canMaintain || saveState === "conflict" || maintenancePending || saveState !== "saved";
	const hasPublicVersion = status === "published" || status === "modified";
	const canPublish =
		canEdit && (status === "draft" || status === "modified" || status === "unpublished");
	const publishLabel =
		status === "modified" ? "更新发布" : status === "unpublished" ? "重新发布" : "发布图集";

	return (
		<PageShell
			title="图集工作稿"
			description={`${detail?.author_name || "未知作者"} · ${GALLERY_STATUS_LABELS[status]} · ${draft.items.length}/${MAX_GALLERY_ITEMS} 张图片`}
			action={
				<>
					<GallerySaveIndicator state={saveState} />
					{hasPublicVersion && publicSlug ? (
						<Button size="sm" variant="outline" asChild>
							<Link to="/galleries/$slug" params={{ slug: publicSlug }}>
								<ExternalLink className="size-4" />
								查看公开页面
							</Link>
						</Button>
					) : null}
					{canPublish ? (
						<Button
							size="sm"
							variant="outline"
							disabled={maintenanceDisabled}
							onClick={() => void handlePublish()}
						>
							{publish.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Send className="size-4" />
							)}
							{publishLabel}
						</Button>
					) : null}
					{hasPublicVersion && canMaintain ? (
						<Button
							size="sm"
							variant="outline"
							disabled={maintenanceDisabled}
							onClick={() => setConfirmAction("unpublish")}
						>
							<EyeOff className="size-4" />
							撤回公开
						</Button>
					) : null}
					{canMaintain ? (
						<Button
							size="sm"
							variant="outline"
							disabled={maintenanceDisabled}
							onClick={() => setConfirmAction("delete")}
						>
							<Trash2 className="size-4" />
							永久删除
						</Button>
					) : null}
					{canEdit ? (
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
					) : null}
				</>
			}
		>
			{operationError ? (
				<div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-start gap-2 text-sm">
						<AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
						<p>{operationError.message}</p>
					</div>
					{operationError.kind === "conflict" ? (
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								void reload().then((reloaded) => {
									if (reloaded) setOperationError(null);
								})
							}
						>
							<RefreshCw className="size-4" />
							重新载入
						</Button>
					) : null}
				</div>
			) : null}

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

			<ConfirmDialog
				open={confirmAction === "unpublish"}
				onOpenChange={(open) => setConfirmAction(open ? "unpublish" : null)}
				onConfirm={() => void handleUnpublish()}
				title="确认撤回公开版本"
				description="撤回后公开地址会返回 404，工作稿、稳定地址和首次发布时间都会保留。"
				confirmLabel="撤回公开"
				loading={unpublish.isPending}
			/>
			<ConfirmDialog
				open={confirmAction === "delete"}
				onOpenChange={(open) => setConfirmAction(open ? "delete" : null)}
				onConfirm={() => void handleDelete()}
				title="确认永久删除图集"
				description="工作稿、公开版本和图片引用都会永久清理，此操作无法撤销。"
				confirmLabel="永久删除"
				loading={remove.isPending}
			/>
		</PageShell>
	);
}
