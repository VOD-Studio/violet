import { useCallback, useState } from "react";
import Cropper, { type Area, type MediaSize, type Point } from "react-easy-crop";
import type { CropRect } from "./types";

export interface ImageCropperProps {
    /** 图片源(object URL 或远程 URL) */
    src: string;
    /** 选区宽高比;undefined 为自由比例 */
    aspect?: number;
    /** 选区变化回调(归一化坐标 0~1);需图片加载拿到自然尺寸后才有效值 */
    onChange: (rect: CropRect | undefined) => void;
}

/**
 * ImageCropper - 基于 react-easy-crop 的选区交互组件。
 *
 * 输出归一化 CropRect(0~1):react-easy-crop 给像素坐标(Area.width/height),
 * 组件内用图片自然宽高归一化。归一化后与图片实际尺寸解耦,便于编码进 URL。
 *
 * Cropper 是受控组件,crop 位置由内部 state 管理(onCropChange 必填)。
 */
export function ImageCropper({ src, aspect, onChange }: ImageCropperProps) {
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

    const onMediaLoaded = useCallback((mediaSize: MediaSize) => {
        setNaturalSize({ w: mediaSize.naturalWidth, h: mediaSize.naturalHeight });
    }, []);

    const onCropComplete = useCallback(
        (_area: Area, areaPixels: Area) => {
            if (!naturalSize || naturalSize.w === 0 || naturalSize.h === 0) return;
            onChange({
                x: areaPixels.x / naturalSize.w,
                y: areaPixels.y / naturalSize.h,
                w: areaPixels.width / naturalSize.w,
                h: areaPixels.height / naturalSize.h,
            });
        },
        [naturalSize, onChange],
    );

    return (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
            <Cropper
                image={src}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onMediaLoaded={onMediaLoaded}
                onCropComplete={onCropComplete}
                objectFit="horizontal-cover"
            />
        </div>
    );
}
