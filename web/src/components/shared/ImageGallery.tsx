/**
 * ImageGallery 组件
 * 通用图片展示组件，支持缩略图展示和原图预览
 * 支持三种模式：single（单图）、gallery（多图画廊）、comment（评论图片）
 */

import { getUploadUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useImagePreview, ImagePreview } from "./ImagePreview";

export interface ImageItem {
  /** 原图 URL（相对路径） */
  url: string;
  /** 缩略图 URL（相对路径，可选） */
  thumbnail?: string;
  /** 图片宽度 */
  width?: number;
  /** 图片高度 */
  height?: number;
}

export type ImageGalleryMode = "single" | "gallery" | "comment";

interface ImageGalleryProps {
  /** 图片列表 */
  images: ImageItem[];
  /** 显示模式 */
  mode?: ImageGalleryMode;
  /** 自定义样式 */
  className?: string;
}

/**
 * ImageGallery 组件
 * 根据不同模式展示图片缩略图，点击预览原图
 */
export function ImageGallery({
  images,
  mode = "gallery",
  className,
}: ImageGalleryProps) {
  const preview = useImagePreview();

  if (!images || images.length === 0) {
    return null;
  }

  // 处理图片点击
  const handleImageClick = (
    index: number,
    e: React.MouseEvent<HTMLImageElement>
  ) => {
    const imageUrls = images.map((img) => getUploadUrl(img.url));
    preview.openPreview(imageUrls, index, e.currentTarget);
  };

  // 获取缩略图 URL（优先使用 thumbnail，否则使用原图）
  const getThumbnailUrl = (image: ImageItem) => {
    return getUploadUrl(image.thumbnail || image.url);
  };

  // 单图模式
  if (mode === "single") {
    const image = images[0];
    return (
      <>
        <img
          src={getThumbnailUrl(image)}
          alt=""
          className={cn(
            "cursor-pointer rounded-lg hover:opacity-90 transition-opacity",
            className
          )}
          onClick={(e) => handleImageClick(0, e)}
        />
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

  // 评论图片模式（小缩略图）
  if (mode === "comment") {
    return (
      <>
        <div className={cn("flex flex-wrap gap-2", className)}>
          {images.map((image, index) => (
            <img
              key={index}
              src={getThumbnailUrl(image)}
              alt=""
              className="max-w-40 max-h-40 object-cover rounded border border-border cursor-pointer hover:opacity-90 transition-opacity"
              onClick={(e) => handleImageClick(index, e)}
            />
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

  // 多图画廊模式（网格布局）
  return (
    <>
      <div
        className={cn(
          "grid gap-4",
          images.length === 1 && "grid-cols-1",
          images.length === 2 && "grid-cols-2",
          images.length === 3 && "grid-cols-3",
          images.length >= 4 && "grid-cols-4",
          className
        )}
      >
        {images.map((image, index) => (
          <img
            key={index}
            src={getThumbnailUrl(image)}
            alt=""
            className="w-full aspect-square object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            onClick={(e) => handleImageClick(index, e)}
          />
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
