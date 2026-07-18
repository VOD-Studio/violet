import { parseCrop } from "@shared/lib/crop-url";
import { contentImageUrl } from "@shared/lib/image-url";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { coverCropTransform, type Size } from "./lib/crop-display";

export interface CroppedImageProps {
    /** 图片 src,可能带 ?crop=x,y,w,h(选区聚焦时) */
    src: string;
    /** 显示宽度档:传则走 contentImageUrl 缩略(webp,GIF 剥参数保动画),
     * crop 参数经合并保留;不传则原图直出(兼容旧行为) */
    width?: number;
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
 * CroppedImage - 显示层图片,支持选区精确复现。
 *
 * 解析 src 的 ?crop= 参数,把选区当作图片本身 cover 进容器:
 * 实测容器与原图尺寸,显式设置 img 的 width/height/left/top(不叠加
 * object-fit/transform scale,避免历史的「双重放大」)。选区宽高比与容器
 * 一致时四边精确贴合;不一致时选区铺满容器、溢出维度居中裁切。
 * 无 ?crop= 退化普通居中 cover。静态图/GIF 统一,原图无损。
 *
 * 测量就绪前 img 隐藏,避免闪现未裁剪的全图。
 */
export function CroppedImage({
    src,
    width,
    aspect,
    className,
    imgClassName,
    alt = "",
    loading,
}: CroppedImageProps) {
    const rect = useMemo(() => parseCrop(src), [src]);
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const [natural, setNatural] = useState<Size | null>(null);
    const [box, setBox] = useState<Size | null>(null);

    // 显示层缩略:crop 参数经 imageUrl 合并保留,聚焦逻辑不受影响
    const displaySrc = width ? contentImageUrl(src, { width }) : src;

    // 容器尺寸:首次测量 + ResizeObserver 跟踪(容器随视口响应式变化)
    useEffect(() => {
        if (!rect) return;
        const el = containerRef.current;
        if (!el) return;
        const measure = () => {
            const r = el.getBoundingClientRect();
            setBox((prev) =>
                prev && prev.w === r.width && prev.h === r.height
                    ? prev
                    : { w: r.width, h: r.height },
            );
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [rect]);

    // 换图后旧自然尺寸作废,等新图 load;缓存命中的图不再触发 load,直接读
    // biome-ignore lint/correctness/useExhaustiveDependencies: displaySrc 是重置触发器,函数体内经 imgRef 间接消费
    useEffect(() => {
        if (!rect) return;
        setNatural(null);
        const img = imgRef.current;
        if (img?.complete && img.naturalWidth > 0) {
            setNatural({ w: img.naturalWidth, h: img.naturalHeight });
        }
    }, [rect, displaySrc]);

    const transform = rect && natural && box ? coverCropTransform(rect, natural, box) : null;

    // 无 ?crop=:普通居中 cover(旧行为)
    if (!rect) {
        return (
            <div
                className={cn("overflow-hidden", className)}
                style={aspect ? { aspectRatio: aspect } : undefined}
            >
                <img
                    src={displaySrc}
                    alt={alt}
                    loading={loading}
                    className={cn("h-full w-full object-cover", imgClassName)}
                />
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={cn("relative overflow-hidden", className)}
            style={aspect ? { aspectRatio: aspect } : undefined}
        >
            <img
                ref={imgRef}
                src={displaySrc}
                alt={alt}
                loading={loading}
                onLoad={(e) =>
                    setNatural({
                        w: e.currentTarget.naturalWidth,
                        h: e.currentTarget.naturalHeight,
                    })
                }
                className={cn("absolute max-w-none", imgClassName)}
                style={
                    transform
                        ? {
                              width: transform.width,
                              height: transform.height,
                              left: transform.left,
                              top: transform.top,
                          }
                        : { visibility: "hidden" }
                }
            />
        </div>
    );
}
