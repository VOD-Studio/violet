import type { MediaPurpose } from "./types";

/**
 * 天然仅支持图片格式的用途集合
 *
 * 头像与表情包固定为图片/动图，禁用视频/音频/文档筛选；
 * 评论与推文未来可能扩展多媒体支持，保持全格式可选。
 */
export const IMAGE_ONLY_PURPOSES = new Set<string>(["avatar", "emoji"]);

/** 判断指定用途是否仅支持图片格式 */
export function isImageOnlyPurpose(purpose?: string): boolean {
	return !!purpose && IMAGE_ONLY_PURPOSES.has(purpose);
}

/** 用途筛选项（下拉选择框使用） */
export const MEDIA_PURPOSE_OPTIONS: { value: string; label: string }[] = [
	{ value: "all", label: "全部用途" },
	{ value: "material", label: "通用素材" },
	{ value: "avatar", label: "头像" },
	{ value: "emoji", label: "表情" },
	{ value: "post", label: "文章" },
	{ value: "comment", label: "评论" },
	{ value: "tweet", label: "推文" },
];

/** 类型筛选项（下拉选择框使用） */
export const MEDIA_TYPE_OPTIONS: { value: string; label: string }[] = [
	{ value: "all", label: "全部类型" },
	{ value: "image", label: "图片" },
	{ value: "video", label: "视频" },
	{ value: "audio", label: "音频" },
	{ value: "file", label: "文档/文件" },
];

/** 用途中文标签映射表 */
export const MEDIA_PURPOSE_LABELS: Record<MediaPurpose, string> = {
	material: "通用素材",
	avatar: "头像",
	emoji: "表情",
	post: "文章",
	comment: "评论",
	tweet: "推文",
};
