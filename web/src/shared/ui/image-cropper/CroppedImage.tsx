import { parseCrop } from "@shared/lib/crop-url";
import { useMemo } from "react";
import { cn } from "@/shared/lib/utils";

export interface CroppedImageProps {
    /** 图片 src,可能带 ?crop=x,y,w,h(选区聚焦时) */
    src: string;
    /** 容器宽高比(数字);不传则不强制比例 */
    aspect?: number;
    /** 容器 className */
    className?: string;
    /** 内部 img 的额外 className(如 hover 动画) */
    imgClassName?: string;
    /** img alt */
    alt?: string;
    /** img loading,默认不设 */
    loading?: "lazy" | "eager";
}

/**
 * CroppedImage - 显示层图片,支持选区聚焦。
 *
 * 解析 src 的 ?crop= 参数,用 object-position 把 object-fit:cover 的裁剪焦点
 * 对准选区中心。无 ?crop= 退化普通居中 cover。
 *
 * 原理:object-fit:cover 已让图片缩放铺满容器并裁掉溢出部分,
 * object-position(百分比)控制裁剪焦点——0%/100% 对齐左上/右下。
 * 选区中心映射到 object-position 即可聚焦选区,无需 transform 缩放,
 * 避免双重放大。静态图/GIF 统一,原图无损。
 */
export function CroppedImage({
    src,
    aspect,
    className,
    imgClassName,
    alt = "",
    loading,
}: CroppedImageProps) {
    const objectPosition = useMemo(() => {
        const rect = parseCrop(src);
        if (!rect) return undefined;
        // 选区中心(归一化)→ object-position 百分比。
        const cx = rect.w < 1 ? (rect.x + rect.w / 2) / (1 - rect.w) : 0.5;
        const cy = rect.h < 1 ? (rect.y + rect.h / 2) / (1 - rect.h) : 0.5;
        return `${(cx * 100).toFixed(2)}% ${(cy * 100).toFixed(2)}%`;
    }, [src]);

    return (
        <div
            className={cn("overflow-hidden", className)}
            style={aspect ? { aspectRatio: aspect } : undefined}
        >
            <img
                src={src}
                alt={alt}
                loading={loading}
                className={cn("h-full w-full object-cover", imgClassName)}
                style={objectPosition ? { objectPosition } : undefined}
            />
        </div>
    );
}
