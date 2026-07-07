import { Button } from "@shared/ui/base/button";
import { ImageCropper } from "@shared/ui/image-cropper/ImageCropper";
import { Modal } from "@shared/ui/modal";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useChunkedUpload } from "@/features/upload/hooks/use-chunked-upload";
import { type CropRect, cropImageToBlob } from "@/features/upload/lib/crop-image";
import { withCrop } from "@/features/upload/lib/cropUrl";

export type CropUploadResult =
    | { kind: "static"; url: string } // 静态图:重编码上传,URL 干净
    | { kind: "gif"; url: string }; // GIF:原 URL + ?crop=,保留动画

export interface CropUploadDialogProps {
    /** 本地新选文件(头像/素材库上传场景) */
    file?: File;
    /** 选区宽高比;undefined 自由(素材库) */
    aspect?: number;
    /** 上传用途,透传 useChunkedUpload */
    purpose: "avatar" | "cover" | "material";
    /** 上传后文件名(静态图扩展名按 webp 定) */
    fileNameBase?: string;
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onConfirm: (result: CropUploadResult) => void;
}

/**
 * CropUploadDialog - 选区上传编排弹窗。
 *
 * 判定 GIF 分流:
 * - 静态图:canvas 重编码 WebP → useChunkedUpload 上传,真裁剪
 * - GIF:上传原图拿 url → 拼 ?crop= 坐标,保留动画(不重编码)
 *
 * 依赖方向:features/upload → shared/ui(image-cropper/modal),合法。
 */
export function CropUploadDialog({
    file,
    aspect,
    purpose,
    fileNameBase = "cropped",
    open,
    onOpenChange,
    onConfirm,
}: CropUploadDialogProps) {
    const [rect, setRect] = useState<CropRect | undefined>(undefined);
    const [busy, setBusy] = useState(false);
    const { uploadFile } = useChunkedUpload({ purpose });

    // 预览源:本地文件 object URL
    const previewSrc = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);

    // 释放 object URL
    useEffect(() => {
        return () => {
            if (previewSrc) URL.revokeObjectURL(previewSrc);
        };
    }, [previewSrc]);

    const handleConfirm = useCallback(async () => {
        if (!file) {
            toast.error("缺少待裁剪文件");
            return;
        }
        if (!rect) {
            toast.error("请先选定裁剪区域");
            return;
        }
        setBusy(true);
        try {
            if (file.type === "image/gif") {
                // GIF:上传原图(保留动画字节)→ 拼 ?crop= 坐标
                const result = await uploadFile(file);
                if (!result.url) throw new Error("GIF 上传未返回 URL");
                onConfirm({ kind: "gif", url: withCrop(result.url, rect) });
            } else {
                // 静态图:canvas 重编码 WebP 上传
                if (!previewSrc) throw new Error("无可用图片源");
                const blob = await cropImageToBlob(previewSrc, rect);
                const croppedFile = new File([blob], `${fileNameBase}.webp`, {
                    type: "image/webp",
                });
                const result = await uploadFile(croppedFile);
                onConfirm({ kind: "static", url: result.url });
            }
            onOpenChange(false);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "裁剪上传失败");
        } finally {
            setBusy(false);
        }
    }, [file, rect, previewSrc, fileNameBase, uploadFile, onConfirm, onOpenChange]);

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title={file?.type === "image/gif" ? "选区(GIF 保留动画)" : "裁剪上传"}
            size="md"
            footer={
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
                        取消
                    </Button>
                    <Button onClick={handleConfirm} disabled={busy || !rect}>
                        {busy ? "处理中..." : "确认"}
                    </Button>
                </div>
            }
        >
            {previewSrc ? (
                <ImageCropper src={previewSrc} aspect={aspect} onChange={setRect} />
            ) : (
                <p className="text-sm text-muted-foreground">无可用图片源</p>
            )}
        </Modal>
    );
}
