import { describe, expect, it } from "vitest";
import { isGalleryMediaType } from "../media";

describe("isGalleryMediaType — 图集媒体白名单", () => {
	it("接受全部图片类型", () => {
		expect(isGalleryMediaType("image/jpeg")).toBe(true);
		expect(isGalleryMediaType("image/webp")).toBe(true);
		expect(isGalleryMediaType("image/gif")).toBe(true);
		expect(isGalleryMediaType("image/avif")).toBe(true);
	});

	it("接受浏览器原生可播的 mp4/webm 视频", () => {
		expect(isGalleryMediaType("video/mp4")).toBe(true);
		expect(isGalleryMediaType("video/webm")).toBe(true);
	});

	it("拒绝浏览器不可播的视频容器", () => {
		expect(isGalleryMediaType("video/x-matroska")).toBe(false);
		expect(isGalleryMediaType("video/avi")).toBe(false);
		expect(isGalleryMediaType("video/quicktime")).toBe(false);
	});

	it("拒绝非视觉媒体类型", () => {
		expect(isGalleryMediaType("audio/mpeg")).toBe(false);
		expect(isGalleryMediaType("application/pdf")).toBe(false);
		expect(isGalleryMediaType("")).toBe(false);
	});
});
