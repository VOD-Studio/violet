/**
 * Cover - 封面图选择器
 *
 * 封装“从素材库选择封面”的完整交互：已选时显示预览与更换/移除操作，
 * 未选时显示占位按钮，点击后打开 MediaPicker。
 */

import type { MediaFile, MediaType } from "@entities/media/model/types";
import { MediaPicker } from "@features/admin-media/ui/MediaPicker";
import { Button } from "@shared/ui/base/button";
import { ImagePlus } from "lucide-react";
import { useState } from "react";

export interface CoverProps {
    /** 根元素 id，用于外部 label 的 htmlFor 关联 */
    id?: string;
    /** 当前封面图 URL */
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

/**
 * Cover - 封面图选择器
 *
 * 将素材库选择、预览展示、更换/移除操作封装为单一组件，
 * 调用方只需绑定 value 与 onChange。
 */
export function Cover({
    id,
    value,
    onChange,
    onClear,
    title = "选择封面图",
    mediaType = "image",
}: CoverProps) {
    const [open, setOpen] = useState(false);

    const handleConfirm = (files: MediaFile[]) => {
        if (files[0]) {
            onChange(files[0].url);
        }
    };

    return (
        <div id={id} className="space-y-1.5">
            {value ? (
                <div className="group relative overflow-hidden rounded-lg border border-edge-hairline">
                    <img src={value} alt="封面" className="aspect-video w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            onClick={() => setOpen(true)}
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
                    onClick={() => setOpen(true)}
                    className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-edge-hairline text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                    <ImagePlus className="size-5" />
                    选择封面图
                </button>
            )}
            <MediaPicker
                open={open}
                onOpenChange={setOpen}
                mediaType={mediaType}
                title={title}
                onConfirm={handleConfirm}
            />
        </div>
    );
}
