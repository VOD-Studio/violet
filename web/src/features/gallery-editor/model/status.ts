import type { GalleryStatus } from "@entities/gallery/model/types";

/** 管理端图集状态文案。 */
export const GALLERY_STATUS_LABELS: Record<GalleryStatus, string> = {
	draft: "工作稿",
	published: "已发布",
	modified: "有未发布修改",
	unpublished: "已撤回",
};
