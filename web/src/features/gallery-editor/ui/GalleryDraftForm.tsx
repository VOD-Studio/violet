import type { MediaFile } from "@entities/media/model/types";
import { MediaPicker } from "@entities/media/ui/MediaPicker";
import type { GalleryDraftDocument } from "@features/gallery-editor/hooks/useGalleryDraftDocument";
import {
	appendMediaFiles,
	appendUploadedFile,
	MAX_GALLERY_ITEMS,
} from "@features/gallery-editor/model/draft";
import type { CompleteUploadResult } from "@features/upload/model/types";
import { Uploader } from "@features/upload/ui/Uploader";
import {
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Input,
	Label,
	Sortable,
	Textarea,
} from "@violet/ui";
import { ImagePlus } from "lucide-react";
import { useState } from "react";
import { GalleryDraftPreview } from "./GalleryDraftPreview";
import { GalleryItemEditor } from "./GalleryItemEditor";

interface GalleryDraftFormProps {
	draft: GalleryDraftDocument;
	disabled: boolean;
	updateDraft: (updater: (current: GalleryDraftDocument) => GalleryDraftDocument) => void;
}

/** 图集工作稿的字段、媒体选择与顺序编辑，不负责保存和发布。 */
export function GalleryDraftForm({ draft, disabled, updateDraft }: GalleryDraftFormProps) {
	const [pickerOpen, setPickerOpen] = useState(false);
	const [uploadBusy, setUploadBusy] = useState(false);

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

	return (
		<>
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
								<Label htmlFor="gallery-summary">摘要</Label>
								<Textarea
									id="gallery-summary"
									value={draft.summary}
									maxLength={500}
									showCount
									autoSize={{ minRows: 2, maxRows: 8 }}
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

							{!disabled || uploadBusy ? (
								<Uploader<CompleteUploadResult>
									purpose="material"
									onBusyChange={setUploadBusy}
									disabled={disabled || draft.items.length >= MAX_GALLERY_ITEMS}
									accept="image/*"
									maxFiles={Math.max(0, MAX_GALLERY_ITEMS - draft.items.length)}
									label="上传图片并加入工作稿"
									hint="支持拖拽或多选；上传完成后会自动加入末尾"
									onUploaded={addUploadedFile}
								/>
							) : null}

							<Sortable
								aria-label="图集图片顺序"
								items={draft.items}
								getId={(item) => item.file_id}
								getLabel={(item) =>
									item.caption ||
									item.alt_text_override ||
									item.asset_alt_text ||
									"图片"
								}
								disabled={disabled}
								onReorder={(items) =>
									updateDraft((current) => ({ ...current, items }))
								}
								renderItem={(item, index) => (
									<GalleryItemEditor
										item={item}
										index={index}
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
								)}
							/>
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
		</>
	);
}
