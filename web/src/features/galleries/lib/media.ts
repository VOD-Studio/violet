/**
 * 图集媒体类型判定（PRD-0022 白名单：全部图片 + 浏览器原生可播的 mp4/webm 视频）。
 *
 * 上传域接受更多视频格式，但 avi/mkv 等浏览器基本不能播，进公开图集就是坏内容——
 * 白名单是图集域自己的校验层，与后端 GalleryMediaChecker 同构。
 */

/** 文件选择器的 accept 值，与 {@link isGalleryMediaType} 保持同一白名单 */
export const GALLERY_MEDIA_ACCEPT = "image/*,video/mp4,video/webm";

/**
 * 判定 MIME 类型是否可进图集。
 *
 * @param mime - 文件 MIME 类型（如 "image/webp" / "video/mp4" / "video/x-matroska"）
 * @returns 图片（任意 image/*）或 mp4/webm 视频返回 true
 */
export function isGalleryMediaType(mime: string): boolean {
	return mime.startsWith("image/") || mime === "video/mp4" || mime === "video/webm";
}
