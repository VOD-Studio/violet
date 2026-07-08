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
    /** 本地新选文件(头像/素材库上传场景);与 srcUrl 二选一 */
    file?: File;
    /** 已有素材 URL(封面选择场景,静态图会重新裁剪上传);与 file 二选一 */
    srcUrl?: string;
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
 * 两种图片来源:
 * - file(本地新选):GIF 需上传原图拿 url 再拼坐标
 * - srcUrl(已有素材):GIF 直接用该 url 拼坐标(无需上传)
 *
 * 判定 GIF 分流:
 * - 静态图:canvas 重编码 WebP → useChunkedUpload 上传,真裁剪
 * - GIF:拼 ?crop= 坐标,保留动画(不重编码)
 *
 * 依赖方向:features/upload → shared/ui(image-cropper/modal),合法。
 */
export function CropUploadDialog({
    file,
    srcUrl,
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

    // 预览源:优先本地文件 object URL,其次已有素材 URL
    const previewSrc = useMemo(
        () => (file ? URL.createObjectURL(file) : (srcUrl ?? "")),
        [file, srcUrl],
    );
    const isGif =
        file?.type === "image/gif" || srcUrl?.split("?")[0].toLowerCase().endsWith(".gif");

    // 仅本地文件产生的 object URL 需释放(srcUrl 是外部资源不归本组件释放)
    useEffect(() => {
        if (!file) return;
        return () => {
            URL.revokeObjectURL(previewSrc);
        };
    }, [file, previewSrc]);

    const handleConfirm = useCallback(async () => {
        if (!previewSrc) {
            toast.error("缺少待裁剪图片");
            return;
        }
        setBusy(true);
        try {
            if (isGif) {
                // GIF:不重编码。本地文件需先上传拿 url,已有 srcUrl 直接用
                let url = srcUrl;
                if (file) {
                    const result = await uploadFile(file);
                    url = result.url;
                }
                if (!url) throw new Error("GIF 上传未返回 URL");
                onConfirm(rect ? { kind: "gif", url: withCrop(url, rect) } : { kind: "gif", url });
            } else if (rect) {
                // 静态图有选区:canvas 重编码 WebP 上传
                const blob = await cropImageToBlob(previewSrc, rect);
                const croppedFile = new File([blob], `${fileNameBase}.webp`, {
                    type: "image/webp",
                });
                const result = await uploadFile(croppedFile);
                onConfirm({ kind: "static", url: result.url });
            } else if (file) {
                // 无选区:直接上传原文件
                const result = await uploadFile(file);
                onConfirm({ kind: "static", url: result.url });
            } else if (srcUrl) {
                // 已有素材无选区:直接用原 URL
                onConfirm({ kind: "static", url: srcUrl });
            }
            onOpenChange(false);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "上传失败");
        } finally {
            setBusy(false);
        }
    }, [previewSrc, rect, isGif, file, srcUrl, fileNameBase, uploadFile, onConfirm, onOpenChange]);

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title={isGif ? "选区(GIF 保留动画)" : "裁剪上传"}
            size="md"
            footer={
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
                        取消
                    </Button>
                    <Button onClick={handleConfirm} disabled={busy}>
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
