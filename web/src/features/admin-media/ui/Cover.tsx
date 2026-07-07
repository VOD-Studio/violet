/**
 * Cover - 封面图选择器
 *
 * 封装「从素材库选择封面」的完整交互:选完素材直接用原图 URL 回填,
 * 不强制裁剪上传。需要裁剪的场景由用户在素材库预先裁剪好(见 MediaGrid 裁剪 icon)。
 * 已选时显示 CroppedImage 预览(支持带 ?crop= 的封面视觉聚焦)与更换/移除操作。
 */

import type { MediaFile, MediaType } from "@entities/media/model/types";
import { MediaPicker } from "@features/admin-media/ui/MediaPicker";
import { Button } from "@shared/ui/base/button";
import { CroppedImage } from "@shared/ui/image-cropper/CroppedImage";
import { ImagePlus } from "lucide-react";
import { useState } from "react";

export interface CoverProps {
    /** 根元素 id，用于外部 label 的 htmlFor 关联 */
    id?: string;
    /** 当前封面图 URL，可带 ?crop= */
    value: string | undefined | null;
    /** 选择新封面后的回调 */
    onChange: (url: string) => void;
    /** 移除封面后的回调 */
    onClear?: () => void;
    /** 选择弹窗标题 */
    title?: string;
    /** 限定的素材类型，默认图片 */
    mediaType?: MediaType;
}

export function Cover({
    id,
    value,
    onChange,
    onClear,
    title = "选择封面图",
    mediaType = "image",
}: CoverProps) {
    const [pickerOpen, setPickerOpen] = useState(false);

    const handleConfirm = (files: MediaFile[]) => {
        if (files[0]) {
            onChange(files[0].url);
        }
    };

    return (
        <div id={id} className="space-y-1.5">
            {value ? (
                <div className="group relative overflow-hidden rounded-lg border border-edge-hairline">
                    <CroppedImage src={value} aspect={16 / 9} className="w-full" alt="封面" />
                    <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-linear-to-t from-black/60 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            onClick={() => setPickerOpen(true)}
                        >
                            更换
                        </Button>
                        {onClear ? (
                            <Button type="button" variant="secondary" size="xs" onClick={onClear}>
                                移除
                            </Button>
                        ) : null}
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-edge-hairline text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                    <ImagePlus className="size-5" />
                    选择封面图
                </button>
            )}
            <MediaPicker
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                mediaType={mediaType}
                title={title}
                onConfirm={handleConfirm}
            />
        </div>
    );
}
