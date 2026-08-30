import { mediaCatalogKeys } from "@entities/media/api/keys";
import type { MediaFile } from "@entities/media/model/types";
import { useUploadThumbnail } from "@features/upload/api/mutations";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/shared/api/error";
import { FramePicker } from "@/shared/ui/frame-picker";
import { Modal } from "@/shared/ui/modal";

interface MediaCoverDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	file: MediaFile | null;
}

/**
 * MediaCoverDialog - 视频选帧设封面对话框
 *
 * 内嵌通用 FramePicker 组件，用户拖动进度条选择帧后，
 * 截取 JPEG 上传到 POST /uploads/thumbnail 更新封面。
 *
 * 走统一上传接口（/uploads/thumbnail，fileId 经 multipart 字段提交），有 owner 校验，
 * 仅能给自己上传的素材设封面。上传能力归 upload，成功后失效后台素材列表刷新缩略图。
 */
export function MediaCoverDialog({ open, onOpenChange, file }: MediaCoverDialogProps) {
	const uploadThumb = useUploadThumbnail();
	const qc = useQueryClient();

	if (!file) return null;

	const handleConfirm = (blob: Blob) => {
		const coverFile = new File([blob], "cover.jpg", { type: "image/jpeg" });
		uploadThumb.mutate(
			{ id: file.id, file: coverFile },
			{
				onSuccess: () => {
					qc.invalidateQueries({ queryKey: mediaCatalogKeys.lists() });
					toast.success("封面已更新");
					onOpenChange(false);
				},
				onError: (err) => {
					const msg =
						err instanceof ApiError ? err.message : err.message || "设置封面失败";
					toast.error(msg);
				},
			},
		);
	};

	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title="选择视频封面"
			description="拖动滑块选择一帧作为封面，或使用默认的第 1 秒"
			size="lg"
			footer={null}
		>
			<FramePicker
				src={file.url}
				onConfirm={handleConfirm}
				onCancel={() => onOpenChange(false)}
				submitting={uploadThumb.isPending}
			/>
		</Modal>
	);
}
