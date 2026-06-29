import { useUploadThumbnail } from "@features/media/api/mutations";
import type { MediaFile } from "@features/media/model/types";
import { toast } from "sonner";
import { ApiError } from "@/shared/api/error";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/dialog";
import { FramePicker } from "@/shared/ui/frame-picker";

interface MediaCoverDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    file: MediaFile | null;
}

/**
 * MediaCoverDialog - 视频选帧设封面对话框
 *
 * 内嵌通用 FramePicker 组件，用户拖动进度条选择帧后，
 * 截取 JPEG 上传到 POST /media/{id}/thumbnail 更新封面。
 *
 * 注意：当前走用户态接口（/media/{id}/thumbnail），有 owner 校验，
 * 仅能给自己上传的素材设封面。
 */
export function MediaCoverDialog({ open, onOpenChange, file }: MediaCoverDialogProps) {
    const uploadThumb = useUploadThumbnail();

    if (!file) return null;

    const handleConfirm = (blob: Blob) => {
        const coverFile = new File([blob], "cover.jpg", { type: "image/jpeg" });
        uploadThumb.mutate(
            { id: file.id, file: coverFile },
            {
                onSuccess: () => {
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
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>选择视频封面</DialogTitle>
                    <DialogDescription>
                        拖动滑块选择一帧作为封面，或使用默认的第 1 秒
                    </DialogDescription>
                </DialogHeader>
                <FramePicker
                    src={file.url}
                    onConfirm={handleConfirm}
                    onCancel={() => onOpenChange(false)}
                    submitting={uploadThumb.isPending}
                />
            </DialogContent>
        </Dialog>
    );
}
