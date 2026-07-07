import { cn } from "@/shared/lib/utils";

export interface CroppedImageProps {
    /** 图片 src(静态图路径;?crop= 视觉裁剪解析在 Issue-0017 扩展) */
    src: string;
    /** 容器宽高比(数字);不传则不强制比例 */
    aspect?: number;
    /** 容器 className */
    className?: string;
    /** img alt */
    alt?: string;
}

/**
 * CroppedImage - 显示层图片。
 *
 * 本切片(Issue-0016)只做静态显示:无 ?crop= 参数时退化普通 object-cover。
 * Issue-0017 会扩展:解析 src 的 ?crop= 参数,用 CSS transform 聚焦选区,
 * 实现 GIF 无损视觉裁剪。当前对外契约已稳定,后续扩展不破坏调用方。
 */
export function CroppedImage({ src, aspect, className, alt = "" }: CroppedImageProps) {
    return (
        <div
            className={cn("overflow-hidden", className)}
            style={aspect ? { aspectRatio: aspect } : undefined}
        >
            <img src={src} alt={alt} className="h-full w-full object-cover" />
        </div>
    );
}
