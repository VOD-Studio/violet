import { withCrop } from "@shared/lib/crop-url";
import { Button } from "@shared/ui/base/button";
import { ImageCropper } from "@shared/ui/image-cropper/ImageCropper";
import type { CropRect } from "@shared/ui/image-cropper/types";
import { Modal } from "@shared/ui/modal";
import { useState } from "react";

export interface CropSelectDialogProps {
    /** 已有素材 URL,选区后拼 ?crop= 回填 */
    src: string;
    /** 选区宽高比(封面 16/9、头像 1);undefined 自由 */
    aspect?: number;
    open: boolean;
    onOpenChange: (v: boolean) => void;
    /** 确认:回传带 ?crop= 的 URL;跳过选区时回传原图 URL(无 crop) */
    onConfirm: (url: string) => void;
}

/**
 * CropSelectDialog - 纯选区弹窗(不重编码、不上传)。
 *
 * 只把归一化坐标拼到 URL 的 ?crop= 参数,显示层用 CSS 视觉裁剪聚焦选区。
 * 静态图/GIF 统一处理:原图字节不变,无损。
 *
 * 与 CropUploadDialog 的区别:本组件不调 useChunkedUpload/canvas 重编码,
 * 纯前端坐标编辑,适合「展示区域固定但要选聚焦区域」的场景(如封面)。
 */
export function CropSelectDialog({
    src,
    aspect,
    open,
    onOpenChange,
    onConfirm,
}: CropSelectDialogProps) {
    const [rect, setRect] = useState<CropRect | undefined>(undefined);

    const handleConfirm = () => {
        onConfirm(rect ? withCrop(src, rect) : src);
        onOpenChange(false);
    };

    const handleSkip = () => {
        onConfirm(src);
        onOpenChange(false);
    };

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title="选择展示区域"
            size="md"
            footer={
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={handleSkip}>
                        直接使用原图
                    </Button>
                    {rect && (
                        <Button variant="ghost" onClick={() => setRect(undefined)}>
                            清除选区
                        </Button>
                    )}
                    <Button onClick={handleConfirm} disabled={!rect}>
                        确认选区
                    </Button>
                </div>
            }
        >
            <ImageCropper src={src} aspect={aspect} rect={rect} onChange={setRect} />
        </Modal>
    );
}
