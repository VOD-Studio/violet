import type { MediaFile } from "@entities/media/model/types";

/** 桩素材：用例据此断言提交载荷里的 avatar_id */
export const stubMediaFile: MediaFile = {
	id: "media-1",
	owner_id: "user-1",
	purpose: "material",
	original_name: "saber.png",
	url: "/uploads/saber.png",
	size: 1024,
	mime_type: "image/png",
	thumbnail: "/uploads/saber-thumb.png",
	status: "active",
	alt_text: "Saber 立绘",
	created_at: "2026-01-01T00:00:00Z",
};

/**
 * 素材库弹层桩：open 时渲染一个「点了就回传 stubMediaFile」的按钮。
 *
 * @remarks 真实 MediaPicker 是嵌套 Modal，jsdom 下 Radix 走不完退场动画，
 * 而 admin-bots 的用例只关心 PATCH/POST 的载荷形状。
 */
export function StubMediaPicker({
	open,
	onConfirm,
}: {
	open: boolean;
	onConfirm: (files: MediaFile[]) => void;
}) {
	return open ? (
		<button type="button" onClick={() => onConfirm([stubMediaFile])}>
			桩选素材
		</button>
	) : null;
}
