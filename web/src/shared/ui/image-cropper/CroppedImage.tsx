import { parseCrop } from "@features/upload/lib/cropUrl";
import { useMemo } from "react";
import { cn } from "@/shared/lib/utils";
import { cropToStyle } from "./lib/crop-to-style";

export interface CroppedImageProps {
    /** 图片 src,可能带 ?crop=x,y,w,h(GIF 视觉裁剪时) */
    src: string;
    /** 容器宽高比(数字);不传则不强制比例 */
    aspect?: number;
    /** 容器 className */
    className?: string;
    /** img alt */
    alt?: string;
}

/**
 * CroppedImage - 显示层图片,支持视觉裁剪。
 *
 * 解析 src 的 ?crop= 参数,用 CSS transform 把原图聚焦到选区(object-fit:cover
 * 下聚焦选区中心)。无 ?crop= 参数退化普通 object-cover。
 *
 * GIF 场景:原图完整加载,动画无损保留,仅视觉聚焦——这是「无损视觉裁剪」,
 * 对比 canvas 重编码(会丢动画)的静态图路径,此处保留 GIF 原文件字节。
 */
export function CroppedImage({ src, aspect, className, alt = "" }: CroppedImageProps) {
    const rect = useMemo(() => parseCrop(src) ?? undefined, [src]);
    const style = useMemo(
        () => cropToStyle(rect, aspect ?? (rect ? rect.w / rect.h : 16 / 9)),
        [rect, aspect],
    );

    return (
        <div
            className={cn("overflow-hidden", className)}
            style={aspect ? { aspectRatio: aspect } : undefined}
        >
            <img
                src={src}
                alt={alt}
                className="h-full w-full object-cover will-change-transform"
                style={style}
            />
        </div>
    );
}
