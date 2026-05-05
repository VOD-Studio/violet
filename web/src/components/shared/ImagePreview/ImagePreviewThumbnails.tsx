/**
 * 缩略图导航组件
 * 显示在底部，用于快速切换图片
 */

import { cn } from "@/lib/utils";

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
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-2 p-2 rounded-lg bg-black/50 backdrop-blur-sm">
      {images.map((img, i) => (
        <button
          key={i}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(i);
          }}
          className={cn(
            "size-12 rounded overflow-hidden border-2 transition-all",
            i === currentIndex
              ? "border-white scale-110"
              : "border-white/30 hover:border-white/60"
          )}
        >
          <img
            src={img}
            alt={`缩略图 ${i + 1}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </button>
      ))}
    </div>
  );
}
