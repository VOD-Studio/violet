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
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { MediaFile } from "@entities/media/model/types";
import { MediaPicker } from "@entities/media/ui/MediaPicker";
import type { PersonaAdminImage } from "@entities/persona/model/types";
import {
	appendPersonaMedia,
	appendUploadedPersonaImage,
	MAX_PERSONA_IMAGES,
} from "@features/persona-editor/model/document";
import type { CompleteUploadResult } from "@features/upload/model/types";
import { Uploader } from "@features/upload/ui/Uploader";
import { Button } from "@shared/ui/base/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/base/card";
import { ImagePreview } from "@shared/ui/image-preview";
import { ImagePlus } from "lucide-react";
import { useState } from "react";
import { PersonaImageEditor } from "./PersonaImageEditor";

interface PersonaImagesSectionProps {
	images: PersonaAdminImage[];
	disabled: boolean;
	onChange: (images: PersonaAdminImage[]) => void;
}

interface LightboxState {
	open: boolean;
	index: number;
	trigger: HTMLButtonElement | null;
}

const CLOSED_LIGHTBOX: LightboxState = { open: false, index: 0, trigger: null };

/** 设定图选择、上传、排序、描述与灯箱预览工作区。 */
export function PersonaImagesSection({ images, disabled, onChange }: PersonaImagesSectionProps) {
	const [pickerOpen, setPickerOpen] = useState(false);
	const [lightbox, setLightbox] = useState<LightboxState>(CLOSED_LIGHTBOX);
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	const addMedia = (files: MediaFile[]) => {
		onChange(appendPersonaMedia(images, files));
		setPickerOpen(false);
	};

	const addUploaded = (uploaded: CompleteUploadResult, source: File) => {
		onChange(appendUploadedPersonaImage(images, uploaded, source));
	};

	const handleDragEnd = ({ active, over }: DragEndEvent) => {
		if (!over || active.id === over.id) return;
		const from = images.findIndex((image) => image.file_id === String(active.id));
		const to = images.findIndex((image) => image.file_id === String(over.id));
		if (from < 0 || to < 0) return;
		onChange(arrayMove(images, from, to));
	};

	const alts = images.map(
		(image, index) => image.alt_text_override || image.alt_text || `第 ${index + 1} 张设定图`,
	);

	return (
		<Card>
			<CardHeader className="flex-row items-center justify-between gap-4">
				<div>
					<CardTitle>设定图</CardTitle>
					<p className="mt-1 text-xs text-muted-foreground">
						{images.length}/{MAX_PERSONA_IMAGES} 张，第一张作为公开页主视觉
					</p>
				</div>
				{!disabled ? (
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={images.length >= MAX_PERSONA_IMAGES}
						onClick={() => setPickerOpen(true)}
					>
						<ImagePlus className="size-4" />
						从素材库选择
					</Button>
				) : null}
			</CardHeader>
			<CardContent className="space-y-5">
				{!disabled && images.length < MAX_PERSONA_IMAGES ? (
					<Uploader<CompleteUploadResult>
						purpose="material"
						accept="image/*"
						maxFiles={MAX_PERSONA_IMAGES - images.length}
						label="上传设定图并加入档案"
						hint="支持拖拽或多选；上传完成后自动加入列表末尾"
						onUploaded={addUploaded}
					/>
				) : null}

				{images.length === 0 ? (
					<p className="rounded-lg bg-muted/45 px-4 py-8 text-center text-sm text-muted-foreground">
						还没有设定图。上传图片或从自己的素材库中选择。
					</p>
				) : (
					<DndContext
						sensors={sensors}
						collisionDetection={closestCenter}
						onDragEnd={handleDragEnd}
					>
						<SortableContext
							items={images.map((image) => image.file_id)}
							strategy={verticalListSortingStrategy}
						>
							<div>
								{images.map((image, index) => (
									<PersonaImageEditor
										key={image.file_id}
										image={image}
										index={index}
										total={images.length}
										disabled={disabled}
										onPreview={(trigger) =>
											setLightbox({ open: true, index, trigger })
										}
										onChange={(patch) =>
											onChange(
												images.map((candidate) =>
													candidate.file_id === image.file_id
														? { ...candidate, ...patch }
														: candidate,
												),
											)
										}
										onMove={(to) => onChange(arrayMove(images, index, to))}
										onRemove={() =>
											onChange(
												images.filter(
													(candidate) =>
														candidate.file_id !== image.file_id,
												),
											)
										}
									/>
								))}
							</div>
						</SortableContext>
					</DndContext>
				)}
			</CardContent>

			<MediaPicker
				open={pickerOpen}
				onOpenChange={setPickerOpen}
				onConfirm={addMedia}
				multiple
				mediaType="image"
				source="owned"
				title="选择人设图片"
			/>
			<ImagePreview
				open={lightbox.open}
				onClose={() => setLightbox((state) => ({ ...state, open: false }))}
				images={images.map((image) => image.url)}
				thumbnails={images.map((image) => image.thumbnail || image.url)}
				alts={alts}
				currentIndex={lightbox.index}
				onIndexChange={(index) => setLightbox((state) => ({ ...state, index }))}
				triggerElement={lightbox.trigger}
			/>
		</Card>
	);
}
