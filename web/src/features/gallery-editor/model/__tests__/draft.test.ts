import type { GalleryItem } from "@entities/gallery/model/types";
import type { MediaFile } from "@entities/media/model/types";
import { describe, expect, it } from "vitest";
import {
	appendMediaFiles,
	appendUploadedFile,
	buildSaveGalleryInput,
	MAX_GALLERY_ITEMS,
	moveGalleryItem,
	moveGalleryItemById,
} from "../draft";

function galleryItem(fileId: string, position: number): GalleryItem {
	return {
		file_id: fileId,
		position,
		url: `/${fileId}.jpg`,
		thumbnail: "",
		mime_type: "image/jpeg",
		width: 800,
		height: 1200,
		asset_alt_text: `素材 ${fileId}`,
		caption: `说明 ${fileId}`,
		alt_text_override: `替代 ${fileId}`,
	};
}

function mediaFile(id: string, mimeType = "image/jpeg"): MediaFile {
	return {
		id,
		owner_id: "author-1",
		purpose: "material",
		original_name: `${id}.jpg`,
		url: `/${id}.jpg`,
		size: 1024,
		mime_type: mimeType,
		thumbnail: `/${id}-thumb.jpg`,
		status: "active",
		alt_text: `素材 ${id}`,
		created_at: "2026-08-30T00:00:00Z",
	};
}

describe("gallery draft document helpers", () => {
	it("选择素材时跳过重复和非图片，并保留选择顺序", () => {
		const result = appendMediaFiles(
			[galleryItem("a", 0)],
			[mediaFile("a"), mediaFile("video", "video/mp4"), mediaFile("b"), mediaFile("c")],
		);

		expect(result.map((item) => item.file_id)).toEqual(["a", "b", "c"]);
		expect(result.map((item) => item.position)).toEqual([0, 1, 2]);
	});

	it("最多保留 50 张图片", () => {
		const existing = Array.from({ length: MAX_GALLERY_ITEMS - 1 }, (_, index) =>
			galleryItem(`existing-${index}`, index),
		);
		const result = appendMediaFiles(existing, [mediaFile("last"), mediaFile("overflow")]);

		expect(result).toHaveLength(MAX_GALLERY_ITEMS);
		expect(result.at(-1)?.file_id).toBe("last");
	});

	it("上传结果只在来源文件为图片时加入工作稿", () => {
		const upload = {
			file_id: "uploaded",
			url: "/uploaded.jpg",
			thumbnail: "/uploaded-thumb.jpg",
			width: 1200,
			height: 800,
		};

		expect(appendUploadedFile([], upload, "video/mp4")).toEqual([]);
		expect(appendUploadedFile([], upload, "image/jpeg")).toEqual([
			expect.objectContaining({
				file_id: "uploaded",
				mime_type: "image/jpeg",
				position: 0,
			}),
		]);
	});

	it("排序后归一化 position，保存请求不回传 position 或媒体投影", () => {
		const moved = moveGalleryItem(
			[galleryItem("a", 0), galleryItem("b", 1), galleryItem("c", 2)],
			2,
			0,
		);
		const input = buildSaveGalleryInput(7, "标题", "摘要", moved);

		expect(moved.map((item) => `${item.file_id}:${item.position}`)).toEqual([
			"c:0",
			"a:1",
			"b:2",
		]);
		expect(input).toEqual({
			expected_version: 7,
			title: "标题",
			summary: "摘要",
			items: [
				{ file_id: "c", caption: "说明 c", alt_text_override: "替代 c" },
				{ file_id: "a", caption: "说明 a", alt_text_override: "替代 a" },
				{ file_id: "b", caption: "说明 b", alt_text_override: "替代 b" },
			],
		});
	});

	it("拖拽结束按 active/over ID 重排", () => {
		const moved = moveGalleryItemById(
			[galleryItem("a", 0), galleryItem("b", 1), galleryItem("c", 2)],
			"a",
			"c",
		);

		expect(moved.map((item) => `${item.file_id}:${item.position}`)).toEqual([
			"b:0",
			"c:1",
			"a:2",
		]);
	});
});
