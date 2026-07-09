/**
 * 缩略图导航组件
 * 显示在底部，用于快速切换图片
 */

import { cn } from "@/shared/lib/utils";

/** ImagePreviewThumbnails 组件的属性 */
interface ImagePreviewThumbnailsProps {
    /** 图片地址列表 */
    images: string[];
    /** 当前选中索引 */
    currentIndex: number;
    /** 选择图片回调 */
    onSelect: (index: number) => void;
}

/**
 * 缩略图导航组件
 *
 * 功能：
 * - 显示所有图片的缩略图（2-10 张时显示）
 * - 高亮当前选中的图片
 * - 点击切换到对应图片
 */
export function ImagePreviewThumbnails({
    images,
    currentIndex,
    onSelect,
}: ImagePreviewThumbnailsProps) {
    // 只在图片数量在 2-10 之间时显示
    if (images.length <= 1 || images.length > 10) {
        return null;
    }

    return (
        <div className="absolute bottom-2 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-x-auto rounded-lg bg-black/50 p-1.5 backdrop-blur-sm sm:bottom-4 sm:p-2">
            <div className="flex gap-1.5 sm:gap-2">
                {images.map((img, i) => (
                    <button
                        type="button"
                        key={i}
                        onClick={(e) => {
                            e.stopPropagation();
                            onSelect(i);
                        }}
                        className={cn(
                            "size-10 shrink-0 overflow-hidden rounded border-2 transition-all sm:size-12",
                            i === currentIndex
                                ? "scale-110 border-white"
                                : "border-white/30 hover:border-white/60",
                        )}
                    >
                        <img
                            src={img}
                            alt={`缩略图 ${i + 1}`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                        />
                    </button>
                ))}
            </div>
        </div>
    );
}
