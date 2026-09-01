import type { GalleryItem } from "@entities/gallery/model/types";
import type { MediaFile } from "@entities/media/model/types";
import type { SaveGalleryInput } from "@features/gallery-editor/model/types";
import type { CompleteUploadResult } from "@features/upload/model/types";

export const MAX_GALLERY_ITEMS = 50;

/** 按当前数组顺序归一化 position。 */
export function normalizeGalleryItems(items: GalleryItem[]): GalleryItem[] {
	return items.map((item, position) => ({ ...item, position }));
}

/** 追加未重复的图片素材，并遵守 50 张上限。 */
export function appendMediaFiles(items: GalleryItem[], files: MediaFile[]): GalleryItem[] {
	const existing = new Set(items.map((item) => item.file_id));
	const additions: GalleryItem[] = [];
	for (const file of files) {
		if (existing.has(file.id) || !file.mime_type.startsWith("image/")) continue;
		existing.add(file.id);
		additions.push({
			file_id: file.id,
			position: items.length + additions.length,
			url: file.url,
			thumbnail: file.thumbnail,
			mime_type: file.mime_type,
			width: 0,
			height: 0,
			asset_alt_text: file.alt_text ?? "",
			caption: "",
			alt_text_override: "",
		});
		if (items.length + additions.length >= MAX_GALLERY_ITEMS) break;
	}
	return [...items, ...additions];
}

/** 把刚上传完成的图片追加到工作稿。 */
export function appendUploadedFile(
	items: GalleryItem[],
	file: CompleteUploadResult,
	mimeType: string,
): GalleryItem[] {
	if (
		!mimeType.startsWith("image/") ||
		items.some((item) => item.file_id === file.file_id) ||
		items.length >= MAX_GALLERY_ITEMS
	) {
		return items;
	}
	return [
		...items,
		{
			file_id: file.file_id,
			position: items.length,
			url: file.url,
			thumbnail: file.thumbnail ?? "",
			mime_type: mimeType,
			width: file.width ?? 0,
			height: file.height ?? 0,
			asset_alt_text: "",
			caption: "",
			alt_text_override: "",
		},
	];
}

/** 在数组内移动图片，越界请求保持原数组。 */
export function moveGalleryItem(items: GalleryItem[], from: number, to: number): GalleryItem[] {
	if (from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) {
		return items;
	}
	const next = [...items];
	const [moved] = next.splice(from, 1);
	if (!moved) return items;
	next.splice(to, 0, moved);
	return normalizeGalleryItems(next);
}

/** 把拖拽库返回的 active/over ID 转成稳定的数组重排。 */
export function moveGalleryItemById(
	items: GalleryItem[],
	activeId: string,
	overId: string,
): GalleryItem[] {
	return moveGalleryItem(
		items,
		items.findIndex((item) => item.file_id === activeId),
		items.findIndex((item) => item.file_id === overId),
	);
}

/** 把本地编辑状态投影为后端要求的完整保存 document。 */
export function buildSaveGalleryInput(
	expectedVersion: number,
	title: string,
	summary: string,
	items: GalleryItem[],
): SaveGalleryInput {
	return {
		expected_version: expectedVersion,
		title,
		summary,
		items: items.map(({ file_id, caption, alt_text_override }) => ({
			file_id,
			caption,
			alt_text_override,
		})),
	};
}
