/**
 * ImageGrid - 评论图片九宫格展示组件
 *
 * 布局规则：
 * - 1 张：大图单列（max-w-60）
 * - 2 张：双列
 * - 3+ 张：三列九宫格
 * - 超过 9 张：前 9 张，第 9 张叠加 +N 半透明遮罩
 *
 * 点击任意图片打开 ImagePreview 全屏预览（复用 useImagePreview hook）。
 */
import { ImagePreview } from "@shared/ui/image-preview";
import { useImagePreview } from "@shared/ui/image-preview";
import { cn } from "@/shared/lib/utils";

export interface ImageGridImage {
    /** 原图 URL */
    url: string;
    /** 缩略图 URL，可选，fallback 到 url */
    thumbnail?: string;
    /** 图片宽度 */
    width?: number;
    /** 图片高度 */
    height?: number;
}

export interface ImageGridProps {
    /** 图片列表 */
    images: ImageGridImage[];
    /** 自定义样式 */
    className?: string;
}

const MAX_DISPLAY = 9;

export function ImageGrid({ images, className }: ImageGridProps) {
    const preview = useImagePreview();

    if (!images || images.length === 0) {
        return null;
    }

    const count = images.length;
    const showMoreOverlay = count > MAX_DISPLAY;
    const displayImages = showMoreOverlay ? images.slice(0, MAX_DISPLAY) : images;
    const moreCount = count - MAX_DISPLAY;

    const getGridClass = () => {
        if (count === 1) return "grid-cols-1 max-w-60";
        if (count === 2) return "grid-cols-2 max-w-90";
        return "grid-cols-3 max-w-90";
    };

    const handleClick = (index: number, e: React.MouseEvent<HTMLDivElement>) => {
        const urls = images.map((img) => img.url);
        preview.openPreview(urls, index, e.currentTarget);
    };

    return (
        <>
            <div className={cn("grid gap-1", getGridClass(), className)}>
                {displayImages.map((image, index) => (
                    <div key={image.url + index} className="relative aspect-square">
                        <img
                            src={image.thumbnail || image.url}
                            alt=""
                            loading="lazy"
                            className="size-full cursor-pointer rounded border border-edge-hairline object-cover transition-opacity hover:opacity-90"
                            onClick={(e) => handleClick(index, e as unknown as React.MouseEvent<HTMLDivElement>)}
                        />
                        {showMoreOverlay && index === MAX_DISPLAY - 1 && (
                            <div
                                className="absolute inset-0 flex cursor-pointer items-center justify-center rounded bg-black/50"
                                onClick={(e) => handleClick(MAX_DISPLAY - 1, e)}
                            >
                                <span className="text-xl font-medium text-white">+{moreCount}</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <ImagePreview
                open={preview.open}
                images={preview.images}
                currentIndex={preview.currentIndex}
                triggerElement={preview.triggerElement}
                onClose={preview.closePreview}
                onIndexChange={preview.setCurrentIndex}
            />
        </>
    );
}
